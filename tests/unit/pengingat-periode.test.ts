import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { jalankanPengingatPeriode, jenisPengingatUntuk, type DependensiPengingat } from "@/lib/billing/pengingat-periode";
import { buatEmailPengingatPeriode, teksSisaHari } from "@/lib/email/pengingat-periode";
import { akhirHariWIB, startOfDayWIB } from "@/lib/utils/datetime";

type StatusSekolah = "aktif" | "suspend" | "pending_verifikasi";
type PeriodeRow = {
  id: string;
  schoolId: string;
  mulai: Date;
  berakhir: Date;
  masaTenggangHari: number;
  dicabutAt: Date | null;
  namaSekolah: string;
  statusSekolah: StatusSekolah;
};
type Pengingat = { periodeId: string; jenis: "h7" | "h1"; createdAt: Date; selesaiAt: Date | null; penerima: number };
type Admin = { schoolId: string; email: string | null; status: string; role: string };

const s = {
  periode: [] as PeriodeRow[],
  pengingat: [] as Pengingat[],
  permintaan: [] as { schoolId: string; status: string }[],
  admin: [] as Admin[],
  /** Simulasi balapan: findMany mengira belum ada klaim padahal proses lain sudah membuatnya. */
  butaKlaim: false,
};

function kesalahanUnik() {
  return new Prisma.PrismaClientKnownRequestError("duplikat", { code: "P2002", clientVersion: "test" });
}

/** Database tiruan dalam memori, cukup setia untuk bentuk `where` yang dipakai kode. */
function buatDb() {
  const periodeFindMany = vi.fn(
    async ({ where, include }: { where: Record<string, unknown>; include?: unknown }) => {
      const w = where as {
        dicabutAt: null;
        mulai: { lte?: Date; gt?: Date };
        berakhir?: { gte: Date; lte: Date };
        school?: { status: string };
        schoolId?: { in: string[] };
      };
      return s.periode
        .filter((p) => (w.dicabutAt === null ? p.dicabutAt === null : true))
        .filter((p) => (w.mulai.lte ? p.mulai <= w.mulai.lte : true) && (w.mulai.gt ? p.mulai > w.mulai.gt : true))
        .filter((p) => (w.berakhir ? p.berakhir >= w.berakhir.gte && p.berakhir <= w.berakhir.lte : true))
        .filter((p) => (w.school ? p.statusSekolah === w.school.status : true))
        .filter((p) => (w.schoolId ? w.schoolId.in.includes(p.schoolId) : true))
        .sort((a, b) => a.berakhir.getTime() - b.berakhir.getTime())
        .map((p) => ({
          id: p.id,
          schoolId: p.schoolId,
          mulai: p.mulai,
          berakhir: p.berakhir,
          masaTenggangHari: p.masaTenggangHari,
          ...(include ? { school: { id: p.schoolId, nama: p.namaSekolah } } : {}),
        }));
    },
  );
  const db = {
    periodeLangganan: { findMany: periodeFindMany },
    pengingatPeriode: {
      deleteMany: vi.fn(async ({ where }: { where: { selesaiAt: null; createdAt: { lt: Date } } }) => {
        const sebelum = s.pengingat.length;
        s.pengingat = s.pengingat.filter((r) => !(r.selesaiAt === null && r.createdAt < where.createdAt.lt));
        return { count: sebelum - s.pengingat.length };
      }),
      findMany: vi.fn(async ({ where }: { where: { periodeId: { in: string[] } } }) =>
        s.butaKlaim ? [] : s.pengingat.filter((r) => where.periodeId.in.includes(r.periodeId)).map((r) => ({ periodeId: r.periodeId, jenis: r.jenis })),
      ),
      create: vi.fn(async ({ data }: { data: { periodeId: string; jenis: "h7" | "h1" } }) => {
        if (s.pengingat.some((r) => r.periodeId === data.periodeId && r.jenis === data.jenis)) throw kesalahanUnik();
        s.pengingat.push({ ...data, createdAt: new Date(), selesaiAt: null, penerima: 0 });
        return data;
      }),
      delete: vi.fn(async ({ where }: { where: { periodeId_jenis: { periodeId: string; jenis: "h7" | "h1" } } }) => {
        const k = where.periodeId_jenis;
        s.pengingat = s.pengingat.filter((r) => !(r.periodeId === k.periodeId && r.jenis === k.jenis));
      }),
      update: vi.fn(
        async ({ where, data }: { where: { periodeId_jenis: { periodeId: string; jenis: "h7" | "h1" } }; data: { selesaiAt: Date; penerima: number } }) => {
          const k = where.periodeId_jenis;
          const r = s.pengingat.find((x) => x.periodeId === k.periodeId && x.jenis === k.jenis)!;
          Object.assign(r, data);
          return r;
        },
      ),
    },
    permintaanPerpanjangan: {
      findMany: vi.fn(async ({ where }: { where: { schoolId: { in: string[] }; status: string } }) =>
        s.permintaan.filter((p) => where.schoolId.in.includes(p.schoolId) && p.status === where.status).map((p) => ({ schoolId: p.schoolId })),
      ),
    },
    schoolUser: {
      findMany: vi.fn(async ({ where }: { where: { schoolId: { in: string[] }; user: { status: string; role: string } } }) =>
        s.admin
          .filter((a) => where.schoolId.in.includes(a.schoolId) && a.status === where.user.status && a.role === where.user.role)
          .map((a) => ({ schoolId: a.schoolId, user: { email: a.email } })),
      ),
    },
  };
  return db;
}

// Sekarang = 1 Maret 2026 pukul 12.00 WIB (05.00 UTC).
const SEKARANG = new Date("2026-03-01T05:00:00Z");
const HARI = 24 * 60 * 60 * 1000;
const tanggalDalam = (hari: number) => new Date(Date.UTC(2026, 2, 1 + hari)).toISOString().slice(0, 10);

function periode(id: string, sisaHari: number, lain: Partial<PeriodeRow> = {}): PeriodeRow {
  return {
    id,
    schoolId: `sch-${id}`,
    mulai: startOfDayWIB("2026-01-01"),
    berakhir: akhirHariWIB(tanggalDalam(sisaHari)),
    masaTenggangHari: 14,
    dicabutAt: null,
    namaSekolah: `SMP ${id}`,
    statusSekolah: "aktif",
    ...lain,
  };
}
const admin = (schoolId: string, email: string | null, lain: Partial<Admin> = {}): Admin => ({
  schoolId,
  email,
  status: "aktif",
  role: "admin_sekolah",
  ...lain,
});

let kirim: ReturnType<typeof vi.fn>;
function deps(db = buatDb()): { d: DependensiPengingat; db: ReturnType<typeof buatDb> } {
  return { d: { db: db as never, kirim: kirim as never, appUrl: "https://ayotka.id" }, db };
}
const jalan = (now = SEKARANG, dryRun = false, db = buatDb()) => jalankanPengingatPeriode(deps(db).d, { now, dryRun });

beforeEach(() => {
  s.periode = [];
  s.pengingat = [];
  s.permintaan = [];
  s.admin = [];
  s.butaKlaim = false;
  kirim = vi.fn(async () => ({ ok: true }));
});

describe("jenisPengingatUntuk - jendela H-7 dan H-1", () => {
  it.each([
    [8, null],
    [7, "h7"],
    [5, "h7"],
    [2, "h7"],
    [1, "h1"],
    [0, "h1"],
    [-1, null],
    [30, null],
  ])("sisa %i hari -> %s", (sisa, jenis) => {
    expect(jenisPengingatUntuk(sisa)).toBe(jenis);
  });
});

describe("jalankanPengingatPeriode - kapan mengirim", () => {
  beforeEach(() => {
    s.admin = [admin("sch-a", "admin@a.sch.id")];
  });

  it.each([
    [8, null],
    [7, "h7"],
    [4, "h7"],
    [2, "h7"],
    [1, "h1"],
    [0, "h1"],
  ])("periode berakhir %i hari lagi -> pengingat %s", async (sisa, jenis) => {
    s.periode = [periode("a", sisa)];
    const hasil = await jalan();
    if (jenis === null) {
      expect(hasil.terkirim).toHaveLength(0);
      expect(kirim).not.toHaveBeenCalled();
    } else {
      expect(hasil.terkirim).toHaveLength(1);
      expect(hasil.terkirim[0]).toMatchObject({ jenis, sisaHari: sisa, penerima: 1, penerimaGagal: 0 });
      expect(kirim).toHaveBeenCalledTimes(1);
    }
  });

  it("tidak ada pengingat sama sekali untuk periode yang sudah lewat (tenggang/berakhir), belum mulai, dicabut, atau sekolah tidak aktif", async () => {
    s.admin = ["a", "b", "c", "d", "e"].map((x) => admin(`sch-${x}`, `admin@${x}.id`));
    s.periode = [
      periode("a", -1), // sudah lewat (masa tenggang)
      periode("b", 3, { mulai: new Date(SEKARANG.getTime() + HARI) }), // belum mulai
      periode("c", 3, { dicabutAt: new Date() }), // dicabut
      periode("d", 3, { statusSekolah: "suspend" }),
      periode("e", 3, { statusSekolah: "pending_verifikasi" }),
    ];
    const hasil = await jalan();
    expect(hasil.terkirim).toHaveLength(0);
    expect(hasil.dilewati).toHaveLength(0);
    expect(kirim).not.toHaveBeenCalled();
  });

  it("email berisi nama sekolah yang di-escape, tanggal berakhir, dan tautan Periode Baru", async () => {
    s.periode = [periode("a", 7, { namaSekolah: 'SMP <b>"Harapan"</b>' })];
    await jalan();
    const email = kirim.mock.calls[0]![0] as { to: string; subject: string; html: string };
    expect(email.to).toBe("admin@a.sch.id");
    expect(email.subject).toBe('Langganan AyoTKA SMP <b>"Harapan"</b> berakhir 7 hari lagi');
    expect(email.html).toContain("SMP &lt;b&gt;&quot;Harapan&quot;&lt;/b&gt;");
    expect(email.html).not.toContain("<b>");
    expect(email.html).toContain("8 Maret 2026");
    expect(email.html).toContain("https://ayotka.id/admin-sekolah/periode-baru");
    expect(email.html).toContain("14 hari");
  });
});

describe("jalankanPengingatPeriode - hanya dua pengingat per periode", () => {
  beforeEach(() => {
    s.admin = [admin("sch-a", "admin@a.sch.id")];
    s.periode = [periode("a", 7)]; // berakhir 8 Maret 2026
  });
  const hariKe = (tanggal: string) => new Date(`${tanggal}T05:00:00Z`); // pukul 12.00 WIB

  it("dijalankan dua kali pada hari yang sama: hanya sekali terkirim", async () => {
    const db = buatDb();
    await jalan(SEKARANG, false, db);
    const kedua = await jalan(SEKARANG, false, db);
    expect(kedua.terkirim).toHaveLength(0);
    expect(kedua.dilewati).toEqual([expect.objectContaining({ alasan: "sudah_terkirim", jenis: "h7" })]);
    expect(kirim).toHaveBeenCalledTimes(1);
  });

  it("sepanjang pekan terakhir tepat dua email: H-7, lalu H-1; tidak ada di hari-hari lain", async () => {
    const db = buatDb();
    const harian: string[] = [];
    for (const tanggal of ["2026-02-28", "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09"]) {
      const hasil = await jalan(hariKe(tanggal), false, db);
      harian.push(`${tanggal}:${hasil.terkirim.map((t) => t.jenis).join(",")}`);
    }
    expect(harian).toEqual([
      "2026-02-28:", // H-8
      "2026-03-01:h7", // H-7
      "2026-03-02:",
      "2026-03-03:",
      "2026-03-04:",
      "2026-03-05:",
      "2026-03-06:",
      "2026-03-07:h1", // H-1
      "2026-03-08:", // hari terakhir: h1 sudah terkirim
      "2026-03-09:", // masa tenggang: tidak ada pengingat
    ]);
    expect(kirim).toHaveBeenCalledTimes(2);
  });

  it("cron terlewat di hari H-7: pengingat tetap terkirim sekali di hari berikutnya, dan H-1 tetap terkirim", async () => {
    const db = buatDb();
    expect((await jalan(hariKe("2026-03-03"), false, db)).terkirim.map((t) => t.jenis)).toEqual(["h7"]); // H-5, terlambat
    expect((await jalan(hariKe("2026-03-04"), false, db)).terkirim).toHaveLength(0);
    expect((await jalan(hariKe("2026-03-07"), false, db)).terkirim.map((t) => t.jenis)).toEqual(["h1"]);
    expect(kirim).toHaveBeenCalledTimes(2);
  });

  it("periode baru dibuat saat H-1: hanya pengingat H-1 (tidak ada pengingat H-7 yang menyusul)", async () => {
    const db = buatDb();
    expect((await jalan(hariKe("2026-03-07"), false, db)).terkirim.map((t) => t.jenis)).toEqual(["h1"]);
    expect((await jalan(hariKe("2026-03-08"), false, db)).terkirim).toHaveLength(0);
    expect(kirim).toHaveBeenCalledTimes(1);
  });

  it("batas tengah malam WIB: 23.30 WIB masih dihitung hari itu, 00.30 WIB hari berikutnya (jendela H-7 tetap berlaku)", async () => {
    const db = buatDb();
    // 23.30 WIB 1 Maret = 16.30 UTC -> sisa 7 hari -> h7
    const malam = await jalan(new Date("2026-03-01T16:30:00Z"), false, db);
    expect(malam.terkirim[0]).toMatchObject({ jenis: "h7", sisaHari: 7 });
    // 00.30 WIB 2 Maret = 17.30 UTC 1 Maret -> sisa 6 -> sudah terkirim, tidak dobel
    const lewatTengahMalam = await jalan(new Date("2026-03-01T17:30:00Z"), false, db);
    expect(lewatTengahMalam.terkirim).toHaveLength(0);
    expect(kirim).toHaveBeenCalledTimes(1);
  });

  it("pengingat satu periode tidak menghalangi periode lain atau periode berikutnya milik sekolah yang sama", async () => {
    const db = buatDb();
    await jalan(SEKARANG, false, db);
    s.admin.push(admin("sch-b", "admin@b.sch.id"));
    s.periode.push(periode("b", 7));
    const hasil = await jalan(SEKARANG, false, db);
    expect(hasil.terkirim.map((t) => t.periodeId)).toEqual(["b"]);
  });
});

describe("jalankanPengingatPeriode - kapan dilewati", () => {
  beforeEach(() => {
    s.admin = [admin("sch-a", "admin@a.sch.id")];
    s.periode = [periode("a", 7)];
  });

  it("sekolah sudah punya periode berikutnya: dilewati (perpanjangan sudah terjadwal)", async () => {
    s.periode.push(periode("lanjut", 60, { schoolId: "sch-a", mulai: new Date(akhirHariWIB(tanggalDalam(7)).getTime() + 1) }));
    const hasil = await jalan();
    expect(hasil.terkirim).toHaveLength(0);
    expect(hasil.dilewati).toEqual([expect.objectContaining({ periodeId: "a", alasan: "periode_berikutnya_ada" })]);
    expect(kirim).not.toHaveBeenCalled();
  });

  it("periode berikutnya yang sudah dicabut tidak dihitung", async () => {
    s.periode.push(
      periode("lanjut", 60, { schoolId: "sch-a", mulai: new Date(akhirHariWIB(tanggalDalam(7)).getTime() + 1), dicabutAt: new Date() }),
    );
    expect((await jalan()).terkirim).toHaveLength(1);
  });

  it("sekolah sudah mengajukan perpanjangan yang menunggu: dilewati; yang sudah diproses tidak menghalangi", async () => {
    s.permintaan = [{ schoolId: "sch-a", status: "disetujui" }];
    expect((await jalan()).terkirim).toHaveLength(1);

    s.pengingat = [];
    kirim.mockClear();
    s.permintaan = [{ schoolId: "sch-a", status: "menunggu" }];
    const hasil = await jalan();
    expect(hasil.dilewati).toEqual([expect.objectContaining({ alasan: "permintaan_menunggu" })]);
    expect(kirim).not.toHaveBeenCalled();
  });

  it.each([
    ["tidak ada admin sekolah", () => (s.admin = [])],
    ["admin sekolah dinonaktifkan", () => (s.admin = [admin("sch-a", "admin@a.sch.id", { status: "nonaktif" })])],
    ["email admin kosong atau tidak valid", () => (s.admin = [admin("sch-a", null), admin("sch-a", "   "), admin("sch-a", "bukan-email")])],
    ["akun bukan peran admin sekolah", () => (s.admin = [admin("sch-a", "x@a.id", { role: "siswa" })])],
  ])("%s: dilewati tanpa membuat klaim", async (_nama, siapkan) => {
    siapkan();
    const hasil = await jalan();
    expect(hasil.dilewati).toEqual([expect.objectContaining({ alasan: "tanpa_penerima" })]);
    expect(s.pengingat).toHaveLength(0); // jatah tidak terpakai, jadi admin yang ditambahkan kemudian masih bisa dikirimi
    expect(kirim).not.toHaveBeenCalled();
  });

  it("alamat dirapikan dan didedup (huruf besar/kecil), tiap penerima mendapat emailnya sendiri", async () => {
    s.admin = [admin("sch-a", "Admin@Sekolah.id"), admin("sch-a", " admin@sekolah.id "), admin("sch-a", "wakil@sekolah.id")];
    const hasil = await jalan();
    expect(hasil.terkirim[0]!.penerima).toBe(2);
    expect(kirim.mock.calls.map((c) => (c[0] as { to: string }).to).sort()).toEqual(["admin@sekolah.id", "wakil@sekolah.id"]);
  });
});

describe("jalankanPengingatPeriode - pengiriman gagal dan balapan", () => {
  beforeEach(() => {
    s.admin = [admin("sch-a", "admin@a.sch.id")];
    s.periode = [periode("a", 7)];
  });

  it("semua email gagal: klaim dilepas, dilaporkan gagal, dan dicoba lagi di proses berikutnya", async () => {
    const db = buatDb();
    kirim.mockResolvedValue({ ok: false, error: "kuota habis" });
    const gagal = await jalan(SEKARANG, false, db);
    expect(gagal.terkirim).toHaveLength(0);
    expect(gagal.gagal).toEqual([expect.objectContaining({ periodeId: "a", galat: "kuota habis" })]);
    expect(s.pengingat).toHaveLength(0);

    kirim.mockResolvedValue({ ok: true });
    const ulang = await jalan(SEKARANG, false, db);
    expect(ulang.terkirim).toHaveLength(1);
    expect(s.pengingat).toEqual([expect.objectContaining({ jenis: "h7", penerima: 1 })]);
  });

  it("pengirim melempar galat: diperlakukan seperti gagal, tidak menjatuhkan proses", async () => {
    kirim.mockRejectedValue(new Error("jaringan putus"));
    const hasil = await jalan();
    expect(hasil.gagal).toEqual([expect.objectContaining({ galat: "jaringan putus" })]);
    expect(s.pengingat).toHaveLength(0);
  });

  it("sebagian penerima gagal: tetap dihitung terkirim (agar tidak dobel ke yang sudah menerima), selisihnya dilaporkan", async () => {
    s.admin = [admin("sch-a", "satu@a.id"), admin("sch-a", "dua@a.id")];
    kirim.mockImplementation(async ({ to }: { to: string }) => (to === "dua@a.id" ? { ok: false, error: "ditolak" } : { ok: true }));
    const hasil = await jalan();
    expect(hasil.terkirim[0]).toMatchObject({ penerima: 1, penerimaGagal: 1 });
    expect(s.pengingat[0]).toMatchObject({ penerima: 1 });
    expect(s.pengingat[0]!.selesaiAt).not.toBeNull();
  });

  it("galat pada satu sekolah tidak menghentikan sekolah lain", async () => {
    s.admin.push(admin("sch-b", "admin@b.sch.id"));
    s.periode.push(periode("b", 7));
    kirim.mockImplementation(async ({ to }: { to: string }) => (to === "admin@a.sch.id" ? { ok: false, error: "ditolak" } : { ok: true }));
    const hasil = await jalan();
    expect(hasil.gagal.map((g) => g.periodeId)).toEqual(["a"]);
    expect(hasil.terkirim.map((t) => t.periodeId)).toEqual(["b"]);
  });

  it("proses lain sudah mengklaim tepat sebelumnya (balapan): dilewati, tidak ada email ganda", async () => {
    const db = buatDb();
    s.pengingat = [{ periodeId: "a", jenis: "h7", createdAt: SEKARANG, selesaiAt: null, penerima: 0 }];
    s.butaKlaim = true; // pemeriksaan awal tidak melihat klaim itu; hanya batas unik saat create yang menahan
    const hasil = await jalan(SEKARANG, false, db);
    expect(hasil.dilewati).toEqual([expect.objectContaining({ alasan: "diklaim_proses_lain" })]);
    expect(hasil.gagal).toHaveLength(0);
    expect(kirim).not.toHaveBeenCalled();
    expect(s.pengingat).toHaveLength(1); // klaim milik proses lain tidak dihapus
  });

  it("klaim basi (proses mati di tengah jalan > 1 jam) dilepas dan dicoba lagi; klaim yang masih berjalan dibiarkan", async () => {
    s.pengingat = [{ periodeId: "a", jenis: "h7", createdAt: new Date(SEKARANG.getTime() - 2 * 60 * 60 * 1000), selesaiAt: null, penerima: 0 }];
    expect((await jalan()).terkirim).toHaveLength(1);

    s.pengingat = [{ periodeId: "a", jenis: "h7", createdAt: new Date(SEKARANG.getTime() - 10 * 60 * 1000), selesaiAt: null, penerima: 0 }];
    kirim.mockClear();
    const hasil = await jalan();
    expect(hasil.dilewati).toEqual([expect.objectContaining({ alasan: "sudah_terkirim" })]);
    expect(kirim).not.toHaveBeenCalled();
  });

  it("catatan lama yang sudah selesai tidak pernah dibersihkan", async () => {
    s.pengingat = [{ periodeId: "periode-lain", jenis: "h7", createdAt: new Date("2025-01-01T00:00:00Z"), selesaiAt: new Date("2025-01-01T00:00:00Z"), penerima: 2 }];
    await jalan();
    expect(s.pengingat.some((r) => r.periodeId === "periode-lain")).toBe(true);
  });
});

describe("jalankanPengingatPeriode - mode simulasi (dryRun)", () => {
  it("melaporkan yang AKAN dikirim tanpa mengirim, tanpa mencatat klaim, dan tanpa membersihkan apa pun", async () => {
    s.admin = [admin("sch-a", "satu@a.id"), admin("sch-a", "dua@a.id")];
    s.periode = [periode("a", 7)];
    s.pengingat = [{ periodeId: "basi", jenis: "h7", createdAt: new Date("2020-01-01T00:00:00Z"), selesaiAt: null, penerima: 0 }];
    const hasil = await jalan(SEKARANG, true);
    expect(hasil.dryRun).toBe(true);
    expect(hasil.akanDikirim).toEqual([expect.objectContaining({ periodeId: "a", jenis: "h7", penerima: 2 })]);
    expect(hasil.terkirim).toHaveLength(0);
    expect(kirim).not.toHaveBeenCalled();
    expect(s.pengingat).toHaveLength(1); // tidak ada klaim baru dan klaim basi tidak dihapus
  });

  it("simulasi tetap menerapkan aturan lewati (sudah terkirim, periode berikutnya, permintaan menunggu)", async () => {
    s.admin = [admin("sch-a", "a@a.id"), admin("sch-b", "b@b.id"), admin("sch-c", "c@c.id")];
    s.periode = [periode("a", 7), periode("b", 7), periode("c", 7)];
    s.pengingat = [{ periodeId: "a", jenis: "h7", createdAt: SEKARANG, selesaiAt: SEKARANG, penerima: 1 }];
    s.permintaan = [{ schoolId: "sch-b", status: "menunggu" }];
    const hasil = await jalan(SEKARANG, true);
    expect(hasil.akanDikirim.map((x) => x.periodeId)).toEqual(["c"]);
    expect(hasil.dilewati.map((x) => x.alasan).sort()).toEqual(["permintaan_menunggu", "sudah_terkirim"]);
  });
});

describe("jalankanPengingatPeriode - banyak sekolah", () => {
  it("memproses berurutan dari yang paling dekat berakhir dan melaporkan ringkasan", async () => {
    s.admin = ["a", "b", "c"].map((x) => admin(`sch-${x}`, `admin@${x}.id`));
    s.periode = [periode("a", 6), periode("b", 2), periode("c", 7)];
    const hasil = await jalan();
    expect(hasil.diperiksa).toBe(3);
    expect(hasil.terkirim.map((t) => t.periodeId)).toEqual(["b", "a", "c"]);
  });

  it("tanpa kandidat: tidak ada kueri lanjutan dan tidak ada pengiriman", async () => {
    const db = buatDb();
    const hasil = await jalan(SEKARANG, false, db);
    expect(hasil).toMatchObject({ diperiksa: 0, terkirim: [], dilewati: [], gagal: [] });
    expect(db.pengingatPeriode.findMany).not.toHaveBeenCalled();
    expect(db.schoolUser.findMany).not.toHaveBeenCalled();
  });

  it("kueri kandidat membatasi ke periode aktif milik sekolah aktif yang belum dicabut", async () => {
    const db = buatDb();
    await jalan(SEKARANG, false, db);
    const where = db.periodeLangganan.findMany.mock.calls[0]![0].where as Record<string, unknown>;
    expect(where).toMatchObject({ dicabutAt: null, school: { status: "aktif" }, mulai: { lte: SEKARANG } });
    expect((where.berakhir as { gte: Date }).gte).toEqual(SEKARANG);
  });
});

describe("teksSisaHari dan buatEmailPengingatPeriode", () => {
  const dasar = { namaSekolah: "SMP Harapan", berakhir: akhirHariWIB("2026-03-08"), masaTenggangHari: 14, urlPeriodeBaru: "https://ayotka.id/admin-sekolah/periode-baru" };

  it("teks sisa hari: hari ini, besok, N hari lagi", () => {
    expect(teksSisaHari(0)).toBe("berakhir hari ini");
    expect(teksSisaHari(-3)).toBe("berakhir hari ini");
    expect(teksSisaHari(1)).toBe("berakhir besok");
    expect(teksSisaHari(7)).toBe("berakhir 7 hari lagi");
  });

  it("subjek menyebut nama sekolah dan sisa waktu", () => {
    expect(buatEmailPengingatPeriode({ ...dasar, sisaHari: 7 }).subject).toBe("Langganan AyoTKA SMP Harapan berakhir 7 hari lagi");
    expect(buatEmailPengingatPeriode({ ...dasar, sisaHari: 1 }).subject).toBe("Langganan AyoTKA SMP Harapan berakhir besok");
    expect(buatEmailPengingatPeriode({ ...dasar, sisaHari: 0 }).subject).toBe("Langganan AyoTKA SMP Harapan berakhir hari ini");
  });

  it("baris baru di nama sekolah dibuang dari subjek (mencegah penyisipan header)", () => {
    const { subject } = buatEmailPengingatPeriode({ ...dasar, namaSekolah: "SMP\r\nBcc: orang@lain.id", sisaHari: 7 });
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toBe("Langganan AyoTKA SMP Bcc: orang@lain.id berakhir 7 hari lagi");
  });

  it("isi email: tanggal berakhir, tenggang, langkah-langkah, tautan, dan catatan 'dua kali'", () => {
    const { html } = buatEmailPengingatPeriode({ ...dasar, sisaHari: 7 });
    expect(html).toContain("8 Maret 2026");
    expect(html).toContain("masa tenggang 14 hari");
    expect(html).toContain("Tandai siswa yang sudah lulus");
    expect(html).toContain("Ajukan perpanjangan");
    expect(html).toContain('href="https://ayotka.id/admin-sekolah/periode-baru"');
    expect(html).toContain("hanya dikirim dua kali");
  });

  it("tanpa masa tenggang: kalimat tenggang tidak muncul; nilai berbahaya di tautan di-escape", () => {
    const { html } = buatEmailPengingatPeriode({ ...dasar, masaTenggangHari: 0, sisaHari: 1, urlPeriodeBaru: 'https://x.id/"><script>' });
    expect(html).not.toContain("masa tenggang 0");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });
});
