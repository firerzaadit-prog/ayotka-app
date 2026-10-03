import { describe, expect, it, vi } from "vitest";
import {
  bangunJendela,
  selaraskanKreditBanyakSiswaAman,
  selaraskanKreditSekolah,
  selaraskanKreditSiswa,
  selaraskanKreditSiswaAman,
  susunUlangKredit,
  type BarisKredit,
  type Jendela,
  type RencanaKredit,
} from "@/lib/billing/kredit-pribadi";

const HARI = 24 * 60 * 60 * 1000;
/** Hari ke-d sejak 1 Agustus 2026 00:00 UTC (angka bulat supaya tabel kasus mudah dibaca). */
const T = (d: number) => new Date(Date.UTC(2026, 7, 1) + d * HARI);
/** Selisih dalam hari (untuk durasi). */
const hari = (ms: number) => Math.round((ms / HARI) * 1000) / 1000;
/** Waktu mutlak sebagai hari ke-n sejak 1 Agustus 2026 (untuk membandingkan posisi). */
const rel = (ms: number) => hari(ms - T(0).getTime());

type Baris = BarisKredit & { source?: string };

/** Terapkan rencana ke daftar baris seperti yang dilakukan database (perbarui lalu buat baris baru). */
function terapkan(baris: Baris[], rencana: RencanaKredit): Baris[] {
  const hasil = baris.map((b) => ({ ...b }));
  for (const p of rencana.perbarui) {
    const b = hasil.find((x) => x.id === p.id)!;
    b.startsAt = p.startsAt;
    b.endsAt = p.endsAt;
  }
  rencana.buat.forEach((l, i) => hasil.push({ id: `baru${i}-${hasil.length}`, startsAt: l.startsAt, endsAt: l.endsAt }));
  return hasil;
}
const rentang = (b: BarisKredit) => [rel(b.startsAt.getTime()), rel(b.endsAt.getTime())] as const;
const urut = (baris: BarisKredit[]) => baris.map(rentang).sort((a, b) => a[0] - b[0] || a[1] - b[1]);

describe("bangunJendela", () => {
  const periode = (mulai: number, berakhir: number, ekstra: Partial<{ masaTenggangHari: number; seatQuota: number; dicabutAt: Date | null }> = {}) => ({
    mulai: T(mulai),
    berakhir: T(berakhir),
    masaTenggangHari: 14,
    seatQuota: 100,
    dicabutAt: null,
    ...ekstra,
  });

  it("jendela = periode + masa tenggang; periode di masa depan tetap mulai pada tanggalnya", () => {
    const j = bangunJendela([periode(10, 190)], T(0), 50);
    expect(j).toEqual([{ mulai: T(10), akhir: T(204) }]);
  });

  it("periode yang sudah berjalan dipotong awalnya ke sekarang (hari lampau tidak ditarik mundur)", () => {
    const j = bangunJendela([periode(-30, 150)], T(0), 50);
    expect(j).toEqual([{ mulai: T(0), akhir: T(164) }]);
  });

  it("mengabaikan periode dicabut, yang sudah lewat masa tenggang, dan yang kuotanya kurang dari siswa aktif", () => {
    const j = bangunJendela(
      [
        periode(10, 100, { dicabutAt: T(1) }),
        periode(-200, -50), // berakhir -50, tenggang sampai -36: sudah lewat
        periode(200, 380, { seatQuota: 49 }), // 50 siswa aktif > kuota 49
        periode(400, 580, { seatQuota: 50 }), // pas: dihitung
      ],
      T(0),
      50,
    );
    expect(j).toEqual([{ mulai: T(400), akhir: T(594) }]);
  });

  it("periode yang bersambung (periode baru mulai di masa tenggang periode lama) digabung; yang terpisah tidak", () => {
    const sambung = bangunJendela([periode(-30, 150), periode(151, 330)], T(0), 10);
    expect(sambung).toEqual([{ mulai: T(0), akhir: T(344) }]);
    const terpisah = bangunJendela([periode(10, 50), periode(200, 260)], T(0), 10);
    expect(terpisah).toEqual([
      { mulai: T(10), akhir: T(64) },
      { mulai: T(200), akhir: T(274) },
    ]);
  });
});

describe("susunUlangKredit - tabel kasus", () => {
  const sekarang = T(0);
  const jendela: Jendela[] = [{ mulai: T(10), akhir: T(204) }];

  it("sebagian sudah terpakai sebelum jendela: dipangkas di awal jendela, sisanya dilanjutkan setelah jendela", () => {
    // beli 30 hari yang lalu... mulai hari -5, 30 hari -> berakhir hari 25; jendela mulai hari 10: terpakai 15, sisa 15.
    const baris = [{ id: "a", startsAt: T(-5), endsAt: T(25) }];
    const rencana = susunUlangKredit(baris, jendela, sekarang);
    expect(rencana.perbarui).toEqual([{ id: "a", startsAt: T(-5), endsAt: T(10) }]);
    expect(rencana.buat).toHaveLength(1);
    expect(rencana.buat[0]).toMatchObject({ dariId: "a" });
    expect(rel(rencana.buat[0]!.startsAt.getTime())).toBe(204);
    expect(hari(rencana.buat[0]!.endsAt.getTime() - rencana.buat[0]!.startsAt.getTime())).toBe(15);
  });

  it("belum terpakai sama sekali (mulai tepat di awal jendela): digeser utuh, durasi sama", () => {
    const baris = [{ id: "a", startsAt: T(10), endsAt: T(40) }];
    const rencana = susunUlangKredit(baris, jendela, T(10));
    expect(rencana.buat).toEqual([]);
    expect(rencana.perbarui).toHaveLength(1);
    const p = rencana.perbarui[0]!;
    expect(p.startsAt.getTime()).toBe(T(204).getTime() + 1);
    expect(p.endsAt.getTime() - p.startsAt.getTime()).toBe(30 * HARI);
  });

  it("baru dibeli beberapa detik lalu saat jendela berjalan: digeser utuh, tanpa baris pangkasan setipis milidetik", () => {
    const berjalan: Jendela[] = [{ mulai: T(0), akhir: T(164) }];
    const baris = [{ id: "a", startsAt: new Date(T(0).getTime() - 5_000), endsAt: new Date(T(0).getTime() - 5_000 + 30 * HARI) }];
    const rencana = susunUlangKredit(baris, berjalan, sekarang);
    expect(rencana.buat).toEqual([]);
    expect(rencana.perbarui).toHaveLength(1);
    const p = rencana.perbarui[0]!;
    expect(p.startsAt.getTime()).toBe(T(164).getTime() + 1);
    expect(p.endsAt.getTime() - p.startsAt.getTime()).toBe(30 * HARI);
  });

  it("toleransi hanya semenit: kredit yang sudah berjalan lebih dari itu tetap dipecah menurut pemakaiannya", () => {
    const berjalan: Jendela[] = [{ mulai: T(0), akhir: T(164) }];
    const baris = [{ id: "a", startsAt: new Date(T(0).getTime() - 5 * 60_000), endsAt: new Date(T(0).getTime() - 5 * 60_000 + 30 * HARI) }];
    const rencana = susunUlangKredit(baris, berjalan, sekarang);
    expect(rencana.buat).toHaveLength(1);
    expect(rencana.perbarui).toEqual([{ id: "a", startsAt: baris[0]!.startsAt, endsAt: T(0) }]);
  });

  it("jendela yang sedang berjalan (dipotong ke sekarang): baris berjalan dipangkas tepat sekarang", () => {
    const berjalan: Jendela[] = [{ mulai: T(0), akhir: T(164) }];
    const baris = [{ id: "a", startsAt: T(-10), endsAt: T(20) }];
    const rencana = susunUlangKredit(baris, berjalan, sekarang);
    expect(rencana.perbarui).toEqual([{ id: "a", startsAt: T(-10), endsAt: T(0) }]);
    expect(rencana.buat).toHaveLength(1);
    expect(rencana.buat[0]!.endsAt.getTime() - rencana.buat[0]!.startsAt.getTime()).toBe(20 * HARI);
  });

  it("tidak bersinggungan dengan jendela (berakhir sebelum jendela mulai, atau tanpa jendela): tidak berubah", () => {
    const baris = [{ id: "a", startsAt: T(-5), endsAt: T(10) }]; // berakhir tepat di awal jendela
    expect(susunUlangKredit(baris, jendela, sekarang)).toEqual({ perbarui: [], buat: [] });
    expect(susunUlangKredit([{ id: "b", startsAt: T(-5), endsAt: T(100) }], [], sekarang)).toEqual({ perbarui: [], buat: [] });
  });

  it("kredit yang sudah habis tidak disentuh sama sekali", () => {
    const baris = [{ id: "a", startsAt: T(-40), endsAt: T(-10) }];
    expect(susunUlangKredit(baris, [{ mulai: T(-20), akhir: T(204) }], sekarang)).toEqual({ perbarui: [], buat: [] });
  });

  it("jendela terpisah: sisa kredit melompati jendela pertama dan terpotong lagi oleh jendela kedua bila perlu", () => {
    const dua: Jendela[] = [
      { mulai: T(10), akhir: T(20) },
      { mulai: T(30), akhir: T(40) },
    ];
    // kredit 60 hari mulai hari 0: terpakai 10 (0-10), lompat ke 20, pakai 10 (20-30), lompat ke 40, sisa 40 hari.
    const baris = [{ id: "a", startsAt: T(0), endsAt: T(60) }];
    const hasil = terapkan(baris, susunUlangKredit(baris, dua, T(0)));
    const total = hasil.reduce((n, b) => n + (b.endsAt.getTime() - b.startsAt.getTime()), 0);
    expect(total).toBe(60 * HARI);
    expect(hasil.map(rentang).sort((a, b) => a[0] - b[0])[0]).toEqual([0, 10]);
    for (const b of hasil) {
      for (const w of dua) expect(b.startsAt.getTime() < w.akhir.getTime() && b.endsAt.getTime() > w.mulai.getTime()).toBe(false);
    }
  });

  it("dihitung ulang tanpa perubahan lain: hasil sama (idempoten) dan tidak menambah baris", () => {
    const baris = [{ id: "a", startsAt: T(-5), endsAt: T(25) }];
    const satu = terapkan(baris, susunUlangKredit(baris, jendela, sekarang));
    const ulang = susunUlangKredit(satu, jendela, sekarang);
    expect(ulang).toEqual({ perbarui: [], buat: [] });
    // juga pada hari-hari berikutnya sebelum jendela mulai
    expect(susunUlangKredit(satu, jendela, T(5))).toEqual({ perbarui: [], buat: [] });
  });

  it("pemulihan: periode dicabut sebelum mulai - lanjutan ditarik ke ujung bagian yang sudah terpakai (hari tidak hilang)", () => {
    const baris = [{ id: "a", startsAt: T(-5), endsAt: T(25) }];
    const tertunda = terapkan(baris, susunUlangKredit(baris, jendela, sekarang));
    const pulih = terapkan(tertunda, susunUlangKredit(tertunda, [], sekarang));
    // bagian pertama masih berjalan sampai hari 10, lanjutannya 15 hari mengikuti persis setelahnya
    expect(urut(pulih)).toEqual([
      [-5, 10],
      [10, 25],
    ]);
  });

  it("pemulihan: jendela yang sedang berjalan dicabut - lanjutan ditarik ke sekarang, tepat sebesar sisanya", () => {
    const berjalan: Jendela[] = [{ mulai: T(0), akhir: T(164) }];
    const baris = [{ id: "a", startsAt: T(-10), endsAt: T(20) }];
    const tertunda = terapkan(baris, susunUlangKredit(baris, berjalan, T(0)));
    // beberapa hari kemudian (hari 3), periode dicabut: kredit pribadi hidup lagi dari hari 3 selama 20 hari
    const pulih = terapkan(tertunda, susunUlangKredit(tertunda, [], T(3)));
    const hidup = pulih.filter((b) => b.endsAt.getTime() > T(3).getTime());
    expect(urut(hidup)).toEqual([[3, 23]]);
  });

  it("dua kredit yang antre disusun berurutan, tidak bertumpuk (tidak ada hari yang dipakai dua kali)", () => {
    const antre = [
      { id: "a", startsAt: T(300), endsAt: T(310) }, // 10 hari
      { id: "b", startsAt: T(300), endsAt: T(320) }, // 20 hari
    ];
    const hasil = terapkan(antre, susunUlangKredit(antre, [], sekarang));
    const u = urut(hasil);
    expect(u).toEqual([
      [0, 10],
      [10, 30],
    ]);
  });

  it("kredit berjalan yang tidak bersinggungan menjadi titik tarik bagi kredit antre (ditumpuk setelahnya)", () => {
    const baris = [
      { id: "a", startsAt: T(-10), endsAt: T(5) }, // berjalan, berakhir hari 5, tak bersinggungan
      { id: "b", startsAt: T(300), endsAt: T(310) }, // antre 10 hari
    ];
    const hasil = terapkan(baris, susunUlangKredit(baris, [], sekarang));
    expect(urut(hasil)).toEqual([
      [-10, 5],
      [5, 15],
    ]);
  });
});

/** Pembangkit acak deterministik (mulberry32) supaya tes properti dapat diulang. */
function acak(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("susunUlangKredit - properti acak (3000 skenario)", () => {
  it("total hari terjaga, tidak ada bagian di dalam jendela, dan dihitung ulang hasilnya sama", () => {
    const rnd = acak(20261003);
    const bilang = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));

    for (let n = 0; n < 3000; n++) {
      const now = T(bilang(0, 20));
      // 0-3 jendela terpisah di masa depan/sekarang
      const jumlahJendela = bilang(0, 3);
      const jendela: Jendela[] = [];
      let kursor = now.getTime() + bilang(0, 15) * HARI;
      for (let i = 0; i < jumlahJendela; i++) {
        const mulai = kursor;
        const akhir = mulai + bilang(1, 60) * HARI;
        jendela.push({ mulai: new Date(mulai), akhir: new Date(akhir) });
        kursor = akhir + bilang(2, 40) * HARI; // celah minimal 2 hari: jendela tidak bersambung
      }
      // 1-4 baris: ada yang berjalan, ada yang antre (hasil penundaan lama), ada yang sudah habis
      const jumlahBaris = bilang(1, 4);
      const baris: Baris[] = [];
      for (let i = 0; i < jumlahBaris; i++) {
        const jenis = bilang(0, 2);
        const durasi = bilang(1, 200) * HARI;
        const mulai = jenis === 0 ? now.getTime() - bilang(0, 60) * HARI : jenis === 1 ? now.getTime() + bilang(1, 400) * HARI : now.getTime() - durasi - bilang(1, 30) * HARI;
        baris.push({ id: `b${i}`, startsAt: new Date(mulai), endsAt: new Date(mulai + durasi) });
      }

      const rencana = susunUlangKredit(baris, jendela, now);
      const sesudah = terapkan(baris, rencana);

      // 1) jumlah hari semua kredit terjaga persis (tidak ada yang hilang atau berlipat)
      const durasiSemua = (xs: BarisKredit[]) => xs.reduce((s, b) => s + (b.endsAt.getTime() - b.startsAt.getTime()), 0);
      expect(durasiSemua(sesudah)).toBe(durasiSemua(baris));

      // 2) kredit yang masih hidup tidak punya bagian yang jatuh di dalam jendela (kecuali baris yang tidak disentuh karena habis)
      for (const b of sesudah) {
        if (b.endsAt.getTime() <= now.getTime()) continue;
        for (const w of jendela) {
          expect(b.startsAt.getTime() < w.akhir.getTime() && b.endsAt.getTime() > w.mulai.getTime()).toBe(false);
        }
      }

      // 3) tidak ada baris yang menjadi nol atau negatif
      for (const b of sesudah) expect(b.endsAt.getTime()).toBeGreaterThan(b.startsAt.getTime());

      // 4) dihitung ulang dari hasilnya: tidak ada perubahan lagi (idempoten)
      expect(susunUlangKredit(sesudah, jendela, now)).toEqual({ perbarui: [], buat: [] });

      // 5) baris yang sudah habis tidak berubah
      for (const b of baris.filter((x) => x.endsAt.getTime() <= now.getTime())) {
        const s = sesudah.find((x) => x.id === b.id)!;
        expect(rentang(s)).toEqual(rentang(b));
      }
    }
  });
});

/* ---------------------------------------------------------------------------------------------------------------- */
/* Lapisan database dengan penyimpanan tiruan                                                                       */
/* ---------------------------------------------------------------------------------------------------------------- */

type Siswa = { id: string; schoolId: string | null; jalur: "A" | "B"; deletedAt: Date | null; lulusAt: Date | null };
type Ent = { id: string; studentId: string; planId: string; source: string; invoiceId: string | null; voucherId: string | null; startsAt: Date; endsAt: Date; revokedAt: Date | null };
type Per = { id: string; schoolId: string; mulai: Date; berakhir: Date; masaTenggangHari: number; seatQuota: number; dicabutAt: Date | null };

function buatDb(awal: { siswa: Siswa[]; ent: Ent[]; periode: Per[] }) {
  const s = { siswa: awal.siswa, ent: awal.ent, periode: awal.periode, nomor: 0 };
  const cocokEnt = (e: Ent, w: Record<string, unknown>) => {
    const sumber = (w.source as { in: string[] } | undefined)?.in;
    const studentId = w.studentId as string | { in: string[] } | undefined;
    const gt = (w.endsAt as { gt: Date } | undefined)?.gt;
    return (
      (studentId === undefined || (typeof studentId === "string" ? e.studentId === studentId : studentId.in.includes(e.studentId))) &&
      (!sumber || sumber.includes(e.source)) &&
      (w.revokedAt === undefined || e.revokedAt === null) &&
      (!gt || e.endsAt.getTime() > gt.getTime())
    );
  };
  const db = {
    student: {
      findUnique: async ({ where }: { where: { id: string } }) => s.siswa.find((x) => x.id === where.id) ?? null,
      count: async ({ where }: { where: { schoolId: string } }) =>
        s.siswa.filter((x) => x.schoolId === where.schoolId && x.jalur === "A" && x.deletedAt === null && x.lulusAt === null).length,
      findMany: async ({ where }: { where: { schoolId: string; entitlements: { some: Record<string, unknown> } } }) =>
        s.siswa
          .filter(
            (x) =>
              x.schoolId === where.schoolId &&
              x.jalur === "A" &&
              x.deletedAt === null &&
              x.lulusAt === null &&
              s.ent.some((e) => e.studentId === x.id && cocokEnt(e, where.entitlements.some)),
          )
          .map((x) => ({ id: x.id })),
    },
    entitlement: {
      findMany: async ({ where, distinct }: { where: Record<string, unknown>; distinct?: string[] }) => {
        const hasil = s.ent.filter((e) => cocokEnt(e, where)).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id));
        if (distinct?.includes("studentId")) {
          const lihat = new Set<string>();
          return hasil.filter((e) => (lihat.has(e.studentId) ? false : (lihat.add(e.studentId), true))).map((e) => ({ studentId: e.studentId }));
        }
        return hasil.map((e) => ({ ...e }));
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Ent> }) => {
        Object.assign(s.ent.find((e) => e.id === where.id)!, data);
      },
      create: async ({ data }: { data: Omit<Ent, "id" | "revokedAt"> }) => {
        s.ent.push({ ...data, id: `n${++s.nomor}`, revokedAt: null });
      },
    },
    periodeLangganan: {
      findMany: async ({ where }: { where: { schoolId: string; dicabutAt?: null } }) =>
        s.periode.filter((p) => p.schoolId === where.schoolId && (where.dicabutAt === null ? p.dicabutAt === null : true)),
    },
  };
  return { db: db as never, s };
}

const ent = (id: string, studentId: string, mulai: number, akhir: number, ekstra: Partial<Ent> = {}): Ent => ({
  id,
  studentId,
  planId: "plan-bulanan",
  source: "invoice",
  invoiceId: `inv-${id}`,
  voucherId: null,
  startsAt: T(mulai),
  endsAt: T(akhir),
  revokedAt: null,
  ...ekstra,
});
const siswaA = (id: string, ekstra: Partial<Siswa> = {}): Siswa => ({ id, schoolId: "sek1", jalur: "A", deletedAt: null, lulusAt: null, ...ekstra });
const periodeSek = (mulai: number, berakhir: number, ekstra: Partial<Per> = {}): Per => ({
  id: `p${mulai}`,
  schoolId: "sek1",
  mulai: T(mulai),
  berakhir: T(berakhir),
  masaTenggangHari: 14,
  seatQuota: 100,
  dicabutAt: null,
  ...ekstra,
});

describe("selaraskanKreditSiswa (database tiruan)", () => {
  const sekarang = T(0);

  it("siswa Jalur A: kredit pribadi dipecah dan baris lanjutan membawa paket/invoice yang sama", async () => {
    const { db, s } = buatDb({ siswa: [siswaA("s1")], ent: [ent("e1", "s1", -5, 25)], periode: [periodeSek(10, 190)] });
    const hasil = await selaraskanKreditSiswa(db, "s1", sekarang);
    expect(hasil).toEqual({ diperbarui: 1, dibuat: 1, siswa: 1 });
    const baru = s.ent.find((e) => e.id !== "e1")!;
    expect(baru).toMatchObject({ studentId: "s1", planId: "plan-bulanan", source: "invoice", invoiceId: "inv-e1", revokedAt: null });
    expect(baru.startsAt.getTime()).toBe(T(204).getTime() + 1);
    expect(s.ent.find((e) => e.id === "e1")!.endsAt).toEqual(T(10));
  });

  it("siswa mandiri (Jalur B) tidak pernah ditunda, walau sekolah asalnya punya periode", async () => {
    const { db, s } = buatDb({
      siswa: [siswaA("s1", { jalur: "B" })],
      ent: [ent("e1", "s1", -5, 25)],
      periode: [periodeSek(0, 190)],
    });
    expect(await selaraskanKreditSiswa(db, "s1", sekarang)).toEqual({ diperbarui: 0, dibuat: 0, siswa: 0 });
    expect(s.ent).toHaveLength(1);
    expect(s.ent[0]!.endsAt).toEqual(T(25));
  });

  it("kursi sekolah (school_seat) bukan kredit pribadi: tidak pernah disentuh", async () => {
    const { db, s } = buatDb({
      siswa: [siswaA("s1")],
      ent: [ent("seat", "s1", -5, 190, { source: "school_seat", invoiceId: null })],
      periode: [periodeSek(0, 190)],
    });
    await selaraskanKreditSiswa(db, "s1", sekarang);
    expect(s.ent).toHaveLength(1);
    expect(s.ent[0]!.endsAt).toEqual(T(190));
  });

  it("kuota periode kurang dari siswa aktif: tidak ditunda (siswa mungkin tidak kebagian kursi)", async () => {
    const { db, s } = buatDb({
      siswa: [siswaA("s1"), siswaA("s2"), siswaA("s3")],
      ent: [ent("e1", "s1", -5, 25)],
      periode: [periodeSek(0, 190, { seatQuota: 2 })], // 3 siswa aktif > kuota 2
    });
    await selaraskanKreditSiswa(db, "s1", sekarang);
    expect(s.ent).toHaveLength(1);
    expect(s.ent[0]!.endsAt).toEqual(T(25));
  });

  it("siswa alumni: kredit yang tertunda ditarik kembali supaya langsung bisa dipakai", async () => {
    const { db, s } = buatDb({
      siswa: [siswaA("s1", { lulusAt: T(-1) })],
      ent: [ent("e1", "s1", 205, 220)], // lanjutan hasil penundaan (mulai di masa depan)
      periode: [periodeSek(0, 190)],
    });
    await selaraskanKreditSiswa(db, "s1", sekarang);
    expect(rentang(s.ent[0]!)).toEqual([0, 15]);
  });

  it("siswa dihapus/diarsipkan atau tanpa sekolah: tanpa jendela, hanya pemulihan", async () => {
    const { db, s } = buatDb({
      siswa: [siswaA("s1", { deletedAt: T(-1) })],
      ent: [ent("e1", "s1", -5, 25)],
      periode: [periodeSek(0, 190)],
    });
    await selaraskanKreditSiswa(db, "s1", sekarang);
    expect(s.ent[0]!.endsAt).toEqual(T(25));
  });

  it("dijalankan dua kali: tidak membuat baris ganda", async () => {
    const { db, s } = buatDb({ siswa: [siswaA("s1")], ent: [ent("e1", "s1", -5, 25)], periode: [periodeSek(10, 190)] });
    await selaraskanKreditSiswa(db, "s1", sekarang);
    const jumlah = s.ent.length;
    const lagi = await selaraskanKreditSiswa(db, "s1", sekarang);
    expect(lagi).toEqual({ diperbarui: 0, dibuat: 0, siswa: 0 });
    expect(s.ent).toHaveLength(jumlah);
  });

  it("siswa tidak ada: tidak melempar galat", async () => {
    const { db } = buatDb({ siswa: [], ent: [], periode: [] });
    expect(await selaraskanKreditSiswa(db, "tidak-ada", sekarang)).toEqual({ diperbarui: 0, dibuat: 0, siswa: 0 });
  });
});

describe("selaraskanKreditSekolah (database tiruan)", () => {
  const sekarang = T(0);

  it("hanya siswa Jalur A aktif yang punya kredit pribadi hidup yang diproses; yang lain utuh", async () => {
    const { db, s } = buatDb({
      siswa: [
        siswaA("a1"), // kredit berjalan: dipecah
        siswaA("a2"), // tanpa kredit
        siswaA("b1", { jalur: "B" }), // mandiri: tidak disentuh
        siswaA("l1", { lulusAt: T(-1) }), // alumni: tidak termasuk
        siswaA("x1", { schoolId: "sek-lain" }), // sekolah lain
      ],
      ent: [ent("e1", "a1", -5, 25), ent("e2", "b1", -5, 25), ent("e3", "l1", -5, 25), ent("e4", "x1", -5, 25)],
      periode: [periodeSek(10, 190)],
    });
    const hasil = await selaraskanKreditSekolah(db, "sek1", sekarang);
    expect(hasil).toEqual({ diperbarui: 1, dibuat: 1, siswa: 1 });
    for (const id of ["e2", "e3", "e4"]) expect(s.ent.find((e) => e.id === id)!.endsAt).toEqual(T(25));
    expect(s.ent.find((e) => e.id === "e1")!.endsAt).toEqual(T(10));
  });

  it("periode dicabut: kredit yang ditunda kembali ke sekarang; periode lain yang masih berlaku tetap menunda", async () => {
    const { db, s } = buatDb({ siswa: [siswaA("a1")], ent: [ent("e1", "a1", -5, 25)], periode: [periodeSek(10, 190)] });
    await selaraskanKreditSekolah(db, "sek1", sekarang);
    expect(s.ent).toHaveLength(2);

    s.periode[0]!.dicabutAt = sekarang; // dicabut
    await selaraskanKreditSekolah(db, "sek1", sekarang);
    expect(urut(s.ent.filter((e) => e.endsAt.getTime() > sekarang.getTime()))).toEqual([
      [-5, 10],
      [10, 25],
    ]);
  });

  it("sekolah tanpa siswa berkredit: hanya satu pencarian, tidak menyentuh apa pun", async () => {
    const { db, s } = buatDb({ siswa: [siswaA("a1")], ent: [], periode: [periodeSek(10, 190)] });
    expect(await selaraskanKreditSekolah(db, "sek1", sekarang)).toEqual({ diperbarui: 0, dibuat: 0, siswa: 0 });
    expect(s.ent).toEqual([]);
  });
});

describe("versi aman", () => {
  it("selaraskanKreditSiswaAman menelan galat database dan hanya mencatatnya (pembayaran tidak boleh gagal)", async () => {
    const galat = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rusak = { student: { findUnique: async () => { throw new Error("db mati"); } } } as never;
    await expect(selaraskanKreditSiswaAman(rusak, "s1")).resolves.toBeUndefined();
    expect(galat).toHaveBeenCalled();
    galat.mockRestore();
  });

  it("selaraskanKreditBanyakSiswaAman hanya memeriksa siswa yang punya kredit pribadi hidup", async () => {
    const { db, s } = buatDb({
      siswa: [siswaA("a1"), siswaA("a2")],
      ent: [ent("e1", "a1", -5, 25)],
      periode: [periodeSek(10, 190)],
    });
    await selaraskanKreditBanyakSiswaAman(db, ["a1", "a2"], T(0));
    expect(s.ent).toHaveLength(2); // a1 dipecah, a2 tidak punya kredit
    await expect(selaraskanKreditBanyakSiswaAman(db, [], T(0))).resolves.toBeUndefined();
  });

  it("selaraskanKreditBanyakSiswaAman tidak melempar walau database gagal", async () => {
    const galat = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rusak = { entitlement: { findMany: async () => { throw new Error("db mati"); } } } as never;
    await expect(selaraskanKreditBanyakSiswaAman(rusak, ["a1"])).resolves.toBeUndefined();
    galat.mockRestore();
  });
});
