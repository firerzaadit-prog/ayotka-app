import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/exam/finalize", () => ({ finalizeAttempt: vi.fn() }));

import { tutupPercobaanKedaluwarsaDengan, type DependensiTutup } from "@/lib/exam/tutup-kedaluwarsa";

const SEKARANG = new Date("2026-10-03T10:00:00.000Z");
const menitLalu = (m: number) => new Date(SEKARANG.getTime() - m * 60_000);

type Baris = { id: string; mulaiAt: Date; sisaDetik: number; status?: string };

/** Basis data palsu: findMany mengembalikan semua baris "berjalan", findUnique membaca dari peta yang bisa diubah tes. */
function buatDep(baris: Baris[], tutup = vi.fn().mockResolvedValue(undefined)) {
  const peta = new Map(baris.map((b) => [b.id, { ...b, status: b.status ?? "berjalan" }]));
  const findMany = vi.fn(async () =>
    [...peta.values()]
      .filter((b) => b.status === "berjalan")
      .sort((a, b) => a.mulaiAt.getTime() - b.mulaiAt.getTime())
      .map(({ id, mulaiAt, sisaDetik }) => ({ id, mulaiAt, sisaDetik })),
  );
  const findUnique = vi.fn(async ({ where }: { where: { id: string } }) => peta.get(where.id) ?? null);
  const dep = {
    db: { attempt: { findMany, findUnique } },
    tutup,
    sekarang: () => SEKARANG,
  } as unknown as DependensiTutup;
  return { dep, tutup, findMany, findUnique, peta };
}

describe("tutupPercobaanKedaluwarsaDengan", () => {
  it("menutup percobaan yang waktunya sudah lewat dan membiarkan yang masih berjalan", async () => {
    const { dep, tutup } = buatDep([
      { id: "lewat", mulaiAt: menitLalu(120), sisaDetik: 90 * 60 }, // batas 30 menit lalu
      { id: "masih", mulaiAt: menitLalu(10), sisaDetik: 90 * 60 }, // batas 80 menit lagi
    ]);
    const hasil = await tutupPercobaanKedaluwarsaDengan(dep);
    expect(hasil.ditutup).toEqual(["lewat"]);
    expect(tutup).toHaveBeenCalledTimes(1);
    expect(tutup).toHaveBeenCalledWith("lewat");
    expect(hasil.gagal).toEqual([]);
  });

  it("menganggap tepat di batas waktu sebagai habis", async () => {
    const { dep } = buatDep([{ id: "pas", mulaiAt: menitLalu(60), sisaDetik: 60 * 60 }]);
    const hasil = await tutupPercobaanKedaluwarsaDengan(dep);
    expect(hasil.ditutup).toEqual(["pas"]);
  });

  it("memakai mulaiAt terbaru (sesudah dilanjutkan dari jeda), bukan waktu mulai pertama", async () => {
    // Dimulai 5 jam lalu, tetapi baru dilanjutkan 5 menit lalu dengan sisa 40 menit: belum habis.
    const { dep, tutup } = buatDep([{ id: "dilanjutkan", mulaiAt: menitLalu(5), sisaDetik: 40 * 60 }]);
    const hasil = await tutupPercobaanKedaluwarsaDengan(dep);
    expect(hasil.ditutup).toEqual([]);
    expect(tutup).not.toHaveBeenCalled();
  });

  it("tidak menimpa percobaan yang baru saja dikumpulkan siswa antara pembacaan daftar dan penutupan", async () => {
    const { dep, tutup, peta } = buatDep([{ id: "x", mulaiAt: menitLalu(200), sisaDetik: 60 * 60 }]);
    const asli = dep.db.attempt.findMany as unknown as () => Promise<unknown>;
    // Siswa mengumpulkan tepat setelah daftar dibaca.
    (dep.db.attempt as unknown as { findMany: () => Promise<unknown> }).findMany = async () => {
      const daftar = await asli();
      peta.get("x")!.status = "selesai";
      return daftar;
    };
    const hasil = await tutupPercobaanKedaluwarsaDengan(dep);
    expect(tutup).not.toHaveBeenCalled();
    expect(hasil.ditutup).toEqual([]);
  });

  it("tidak menutup percobaan yang dilanjutkan admin antara pembacaan daftar dan penutupan", async () => {
    const { dep, tutup, peta } = buatDep([{ id: "y", mulaiAt: menitLalu(200), sisaDetik: 60 * 60 }]);
    const asli = dep.db.attempt.findMany as unknown as () => Promise<unknown>;
    (dep.db.attempt as unknown as { findMany: () => Promise<unknown> }).findMany = async () => {
      const daftar = await asli();
      peta.get("y")!.mulaiAt = menitLalu(1); // admin menekan Lanjutkan
      return daftar;
    };
    const hasil = await tutupPercobaanKedaluwarsaDengan(dep);
    expect(tutup).not.toHaveBeenCalled();
    expect(hasil.ditutup).toEqual([]);
  });

  it("meneruskan satu kegagalan tanpa menghentikan sisanya", async () => {
    const tutup = vi.fn(async (id: string) => {
      if (id === "rusak") throw new Error("koneksi putus");
    });
    const { dep } = buatDep(
      [
        { id: "rusak", mulaiAt: menitLalu(300), sisaDetik: 60 * 60 },
        { id: "baik", mulaiAt: menitLalu(200), sisaDetik: 60 * 60 },
      ],
      tutup,
    );
    const hasil = await tutupPercobaanKedaluwarsaDengan(dep);
    expect(hasil.ditutup).toEqual(["baik"]);
    expect(hasil.gagal).toEqual([{ attemptId: "rusak", galat: "koneksi putus" }]);
  });

  it("menghormati batas jumlah per pemanggilan, yang paling lama lebih dulu", async () => {
    const { dep, tutup } = buatDep([
      { id: "a", mulaiAt: menitLalu(500), sisaDetik: 60 },
      { id: "b", mulaiAt: menitLalu(400), sisaDetik: 60 },
      { id: "c", mulaiAt: menitLalu(300), sisaDetik: 60 },
    ]);
    const hasil = await tutupPercobaanKedaluwarsaDengan(dep, { batas: 2 });
    expect(hasil.ditutup).toEqual(["a", "b"]);
    expect(tutup).toHaveBeenCalledTimes(2);
  });

  it("membatasi ke satu penugasan bila diminta", async () => {
    const { dep, findMany } = buatDep([{ id: "a", mulaiAt: menitLalu(500), sisaDetik: 60 }]);
    await tutupPercobaanKedaluwarsaDengan(dep, { assignmentId: "penugasan-1" });
    const arg = (findMany.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0];
    expect(arg.where).toMatchObject({ status: "berjalan", assignmentId: "penugasan-1" });
  });

  it("tidak menyentuh percobaan dijeda atau yang sudah selesai", async () => {
    const { dep, tutup } = buatDep([
      { id: "jeda", mulaiAt: menitLalu(900), sisaDetik: 60, status: "paused" },
      { id: "selesai", mulaiAt: menitLalu(900), sisaDetik: 60, status: "selesai" },
    ]);
    const hasil = await tutupPercobaanKedaluwarsaDengan(dep);
    expect(hasil.diperiksa).toBe(0);
    expect(tutup).not.toHaveBeenCalled();
  });
});
