import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  buatPenghapusAkunLogin,
  GagalHapusAkunLoginError,
  hapusSiswa,
  hapusSiswaMassal,
  ringkasanAuditHapus,
} from "@/lib/students/hapus";

type Opsi = {
  /** ID siswa yang punya riwayat, per sumber. */
  attempt?: string[];
  invoice?: string[];
  saldo?: string[];
  langganan?: string[];
  /** ID akun (users) berperan siswa. Akun lain dianggap bukan siswa. */
  akunSiswa?: string[];
};

/** Database palsu: urutan panggilan dicatat di `urutan` supaya urutan "akun login dulu, baru data" bisa diuji. */
function buatDb(opsi: Opsi = {}) {
  const urutan: string[] = [];
  const baris = (ids?: string[]) => (ids ?? []).map((studentId) => ({ studentId }));
  const tx = {
    attempt: { groupBy: vi.fn(async () => baris(opsi.attempt)) },
    invoice: { groupBy: vi.fn(async () => baris(opsi.invoice)) },
    saldoTransaction: { groupBy: vi.fn(async () => baris(opsi.saldo)) },
    entitlement: { groupBy: vi.fn(async () => baris(opsi.langganan)) },
    student: {
      deleteMany: vi.fn<(arg: unknown) => Promise<void>>(async () => {
        urutan.push("student.deleteMany");
      }),
      updateMany: vi.fn<(arg: unknown) => Promise<void>>(async () => {
        urutan.push("student.updateMany");
      }),
    },
    user: {
      deleteMany: vi.fn<(arg: unknown) => Promise<void>>(async () => {
        urutan.push("user.deleteMany");
      }),
    },
  };
  const db = {
    user: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.filter((id) => (opsi.akunSiswa ?? []).includes(id)).map((id) => ({ id })),
      ),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => {
      urutan.push("transaksi");
      return fn(tx);
    }),
  };
  return { db: db as unknown as PrismaClient, dbMentah: db, tx, urutan };
}

const belumKlaim = (id: string) => ({ id, userId: null });
const sudahKlaim = (id: string) => ({ id, userId: `u-${id}` });

describe("hapusSiswaMassal - tanpa riwayat dihapus permanen", () => {
  it("daftar kosong: tidak menyentuh apa pun", async () => {
    const { db, dbMentah } = buatDb();
    const hapusAkunLogin = vi.fn();
    expect(await hapusSiswaMassal({ db, hapusAkunLogin }, [])).toEqual({ permanen: [], arsip: [], gagal: [] });
    expect(dbMentah.$transaction).not.toHaveBeenCalled();
    expect(hapusAkunLogin).not.toHaveBeenCalled();
  });

  it("belum klaim (tanpa akun login): baris siswa dihapus, akun login tidak disentuh", async () => {
    const { db, tx, urutan } = buatDb();
    const hapusAkunLogin = vi.fn();
    const hasil = await hapusSiswaMassal({ db, hapusAkunLogin }, [belumKlaim("s1"), belumKlaim("s2")]);
    expect(hasil).toEqual({ permanen: ["s1", "s2"], arsip: [], gagal: [] });
    expect(tx.student.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["s1", "s2"] } } });
    expect(tx.student.updateMany).not.toHaveBeenCalled();
    expect(hapusAkunLogin).not.toHaveBeenCalled();
    expect(tx.user.deleteMany).not.toHaveBeenCalled();
    expect(urutan).toEqual(["transaksi", "student.deleteMany"]);
  });

  it("sudah klaim: akun login dihapus DULU, lalu siswa dan baris users dihapus dalam satu transaksi", async () => {
    const { db, tx, urutan } = buatDb({ akunSiswa: ["u-s1"] });
    const hapusAkunLogin = vi.fn(async () => {
      urutan.push("auth.deleteUser");
    });
    const hasil = await hapusSiswaMassal({ db, hapusAkunLogin }, [sudahKlaim("s1")]);
    expect(hasil.permanen).toEqual(["s1"]);
    expect(hapusAkunLogin).toHaveBeenCalledWith("u-s1");
    expect(tx.user.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["u-s1"] }, role: "siswa" } });
    expect(urutan).toEqual(["auth.deleteUser", "transaksi", "student.deleteMany", "user.deleteMany"]);
  });
});

describe("hapusSiswaMassal - dengan riwayat diarsipkan, identitasnya dibebaskan", () => {
  it.each([
    ["pernah ujian", { attempt: ["s1"] }],
    ["punya tagihan", { invoice: ["s1"] }],
    ["punya mutasi saldo", { saldo: ["s1"] }],
    ["punya langganan pribadi (invoice/voucher)", { langganan: ["s1"] }],
  ])("%s: baris disimpan, NISN + kode klaim + tautan akun dikosongkan, akun login tetap dihapus", async (_nama, opsi) => {
    const { db, tx } = buatDb({ ...opsi, akunSiswa: ["u-s1"] });
    const hapusAkunLogin = vi.fn();
    const hasil = await hapusSiswaMassal({ db, hapusAkunLogin }, [sudahKlaim("s1")]);

    expect(hasil).toEqual({ permanen: [], arsip: ["s1"], gagal: [] });
    expect(tx.student.deleteMany).not.toHaveBeenCalled();
    // Email sintetis {nisn}@nisn.ayotka.id tidak boleh mengunci NISN: akun login dihapus juga.
    expect(hapusAkunLogin).toHaveBeenCalledWith("u-s1");
    expect(tx.user.deleteMany).toHaveBeenCalled();

    const [belumDihapus, sudahDihapus] = tx.student.updateMany.mock.calls.map((c) => c[0] as { where: object; data: Record<string, unknown> });
    expect(belumDihapus!.where).toEqual({ id: { in: ["s1"] }, deletedAt: null });
    expect(belumDihapus!.data).toMatchObject({ status: "nonaktif", nisn: null, claimToken: null, userId: null });
    expect(belumDihapus!.data.deletedAt).toBeInstanceOf(Date);
    // Siswa yang sudah pernah di-soft-delete (pembersihan data lama): waktu hapus asli tidak ditimpa.
    expect(sudahDihapus!.where).toEqual({ id: { in: ["s1"] }, deletedAt: { not: null } });
    expect(sudahDihapus!.data).toEqual({ status: "nonaktif", nisn: null, claimToken: null, userId: null });
  });

  it("kursi sekolah (school_seat) bukan riwayat: pemeriksaan langganan mengecualikannya", async () => {
    const { db, tx } = buatDb();
    await hapusSiswaMassal({ db, hapusAkunLogin: vi.fn() }, [belumKlaim("s1")]);
    expect(tx.entitlement.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: { in: ["s1"] }, source: { not: "school_seat" } } }),
    );
  });
});

describe("hapusSiswaMassal - campuran dan kegagalan sebagian", () => {
  it("sebagian permanen, sebagian arsip, sebagian gagal: yang gagal TIDAK ikut diubah", async () => {
    const { db, tx } = buatDb({ attempt: ["s2"], akunSiswa: ["u-s2", "u-s3"] });
    const hapusAkunLogin = vi.fn(async (userId: string) => {
      if (userId === "u-s3") throw new GagalHapusAkunLoginError();
    });
    const hasil = await hapusSiswaMassal({ db, hapusAkunLogin }, [belumKlaim("s1"), sudahKlaim("s2"), sudahKlaim("s3")]);

    expect(hasil).toEqual({ permanen: ["s1"], arsip: ["s2"], gagal: ["s3"] });
    expect(tx.student.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["s1"] } } });
    expect(tx.student.updateMany.mock.calls[0]![0]).toMatchObject({ where: { id: { in: ["s2"] } } });
    // Baris users s3 tetap ada (akun loginnya masih ada di layanan autentikasi): penghapusan bisa diulang.
    expect(tx.user.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["u-s2"] }, role: "siswa" } });
  });

  it("semua akun gagal dihapus: tidak ada transaksi sama sekali", async () => {
    const { db, dbMentah } = buatDb({ akunSiswa: ["u-s1", "u-s2"] });
    const hapusAkunLogin = vi.fn().mockRejectedValue(new Error("jaringan putus"));
    const hasil = await hapusSiswaMassal({ db, hapusAkunLogin }, [sudahKlaim("s1"), sudahKlaim("s2")]);
    expect(hasil).toEqual({ permanen: [], arsip: [], gagal: ["s1", "s2"] });
    expect(dbMentah.$transaction).not.toHaveBeenCalled();
  });

  it("akun yang tertaut bukan berperan siswa (data salah tautan) tidak pernah dihapus", async () => {
    const { db, dbMentah, tx } = buatDb({ akunSiswa: [] }); // u-s1 ternyata admin
    const hapusAkunLogin = vi.fn();
    const hasil = await hapusSiswaMassal({ db, hapusAkunLogin }, [sudahKlaim("s1")]);
    expect(dbMentah.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["u-s1"] }, role: "siswa" } }),
    );
    expect(hasil.permanen).toEqual(["s1"]);
    expect(hapusAkunLogin).not.toHaveBeenCalled();
    expect(tx.user.deleteMany).not.toHaveBeenCalled();
  });

  it("penghapusan akun login dibatasi paling banyak 5 serentak (tidak membanjiri layanan autentikasi)", async () => {
    const daftar = Array.from({ length: 12 }, (_, i) => sudahKlaim(`s${i}`));
    const { db } = buatDb({ akunSiswa: daftar.map((s) => s.userId) });
    let aktif = 0;
    let puncak = 0;
    const hapusAkunLogin = vi.fn(async () => {
      aktif++;
      puncak = Math.max(puncak, aktif);
      await new Promise((r) => setTimeout(r, 5));
      aktif--;
    });
    const hasil = await hapusSiswaMassal({ db, hapusAkunLogin }, daftar);
    expect(hapusAkunLogin).toHaveBeenCalledTimes(12);
    expect(puncak).toBeLessThanOrEqual(5);
    expect(puncak).toBeGreaterThan(1);
    expect(hasil.permanen).toHaveLength(12);
  });
});

describe("hapusSiswa (satu siswa) membungkus jalur massal", () => {
  it("mengembalikan mode permanen / arsip", async () => {
    expect(await hapusSiswa({ db: buatDb().db, hapusAkunLogin: vi.fn() }, belumKlaim("s1"))).toBe("permanen");
    expect(await hapusSiswa({ db: buatDb({ attempt: ["s1"] }).db, hapusAkunLogin: vi.fn() }, belumKlaim("s1"))).toBe("arsip");
  });

  it("akun login gagal dihapus -> GagalHapusAkunLoginError dan TIDAK ADA data yang diubah", async () => {
    const { db, dbMentah, tx } = buatDb({ akunSiswa: ["u-s1"] });
    const hapusAkunLogin = vi.fn().mockRejectedValue(new GagalHapusAkunLoginError());
    await expect(hapusSiswa({ db, hapusAkunLogin }, sudahKlaim("s1"))).rejects.toBeInstanceOf(GagalHapusAkunLoginError);
    expect(dbMentah.$transaction).not.toHaveBeenCalled();
    expect(tx.student.deleteMany).not.toHaveBeenCalled();
    expect(tx.student.updateMany).not.toHaveBeenCalled();
  });
});

describe("ringkasanAuditHapus", () => {
  it("membedakan hapus permanen dan arsip", () => {
    expect(ringkasanAuditHapus("permanen")).toEqual({ dihapusPermanen: true });
    expect(ringkasanAuditHapus("arsip")).toMatchObject({ diarsipkan: true, nisn: null, claimToken: null, userId: null });
  });
});

describe("buatPenghapusAkunLogin", () => {
  const klien = (error: { message: string; status?: number } | null) => ({
    auth: { admin: { deleteUser: vi.fn(async () => ({ error })) } },
  });

  it("berhasil", async () => {
    const k = klien(null);
    await expect(buatPenghapusAkunLogin(k)("u1")).resolves.toBeUndefined();
    expect(k.auth.admin.deleteUser).toHaveBeenCalledWith("u1");
  });

  it("akun sudah tidak ada (404 / 'User not found') dianggap sukses, supaya penghapusan bisa diulang", async () => {
    await expect(buatPenghapusAkunLogin(klien({ message: "x", status: 404 }))("u1")).resolves.toBeUndefined();
    await expect(buatPenghapusAkunLogin(klien({ message: "User not found" }))("u1")).resolves.toBeUndefined();
  });

  it("galat lain -> GagalHapusAkunLoginError", async () => {
    await expect(buatPenghapusAkunLogin(klien({ message: "boom", status: 500 }))("u1")).rejects.toBeInstanceOf(
      GagalHapusAkunLoginError,
    );
  });
});
