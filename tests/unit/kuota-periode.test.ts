import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  sekolah: vi.fn(),
  periode: vi.fn(),
  jumlahSiswa: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    school: { findUnique: m.sekolah },
    periodeLangganan: { findMany: m.periode },
    student: { count: m.jumlahSiswa },
  },
}));

import { assertKuotaTersedia, KuotaPenuhError, kuotaAcuanSekolah } from "@/lib/students/create";
import { schoolCreateSchema, schoolUpdateSchema } from "@/lib/validations/school";
import { akhirHariWIB, startOfDayWIB } from "@/lib/utils/datetime";

function periode(mulai: string, berakhir: string, seatQuota: number, lain: Record<string, unknown> = {}) {
  return {
    id: `p-${mulai}`,
    schoolId: "sch-1",
    nama: null,
    mulai: startOfDayWIB(mulai),
    berakhir: akhirHariWIB(berakhir),
    masaTenggangHari: 14,
    seatQuota,
    catatan: null,
    dicabutAt: null,
    dibuatOlehId: null,
    createdAt: new Date(),
    ...lain,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-01T05:00:00Z"));
  m.sekolah.mockResolvedValue({ id: "sch-1" });
  m.jumlahSiswa.mockResolvedValue(0);
});
afterEach(() => vi.useRealTimers());

describe("kuotaAcuanSekolah", () => {
  it("kuota periode yang sedang berjalan", async () => {
    m.periode.mockResolvedValue([periode("2026-01-01", "2026-06-30", 80)]);
    expect(await kuotaAcuanSekolah("sch-1")).toBe(80);
  });

  it("belum ada yang berjalan: kuota periode terdekat berikutnya", async () => {
    m.periode.mockResolvedValue([periode("2026-07-01", "2026-12-31", 120)]);
    expect(await kuotaAcuanSekolah("sch-1")).toBe(120);
  });

  it("tanpa periode, atau semua sudah berakhir: null (tidak ada batas yang berlaku)", async () => {
    m.periode.mockResolvedValue([]);
    expect(await kuotaAcuanSekolah("sch-1")).toBeNull();
    m.periode.mockResolvedValue([periode("2025-01-01", "2025-06-30", 50)]);
    expect(await kuotaAcuanSekolah("sch-1")).toBeNull();
  });
});

describe("assertKuotaTersedia - batas tambah/impor siswa per periode", () => {
  it("sekolah tidak ditemukan: tidak melempar (ditangani pemanggil)", async () => {
    m.sekolah.mockResolvedValue(null);
    await expect(assertKuotaTersedia("tidak-ada", 1)).resolves.toBeUndefined();
  });

  it("belum pernah punya periode: ditolak dengan arahan menghubungi admin pusat", async () => {
    m.periode.mockResolvedValue([]);
    await expect(assertKuotaTersedia("sch-1", 1)).rejects.toThrow(/belum memiliki periode langganan/);
  });

  it("langganan berakhir (lewat tenggang): ditolak dengan tanggal berakhirnya, sekolah dibekukan", async () => {
    m.periode.mockResolvedValue([periode("2025-07-01", "2025-12-31", 100)]);
    const galat = await assertKuotaTersedia("sch-1", 1).catch((e) => e);
    expect(galat).toBeInstanceOf(KuotaPenuhError);
    expect(galat.message).toMatch(/berakhir pada 31 Desember 2025/);
    expect(galat.message).toMatch(/memperpanjang/);
  });

  it("periode berjalan dengan sisa kuota: lolos", async () => {
    m.periode.mockResolvedValue([periode("2026-01-01", "2026-06-30", 100)]);
    m.jumlahSiswa.mockResolvedValue(90);
    await expect(assertKuotaTersedia("sch-1", 10)).resolves.toBeUndefined();
  });

  it("melebihi kuota: ditolak dengan rincian kuota, terdaftar, dan sisa", async () => {
    m.periode.mockResolvedValue([periode("2026-01-01", "2026-06-30", 100)]);
    m.jumlahSiswa.mockResolvedValue(95);
    const galat = await assertKuotaTersedia("sch-1", 10).catch((e) => e);
    expect(galat).toBeInstanceOf(KuotaPenuhError);
    expect(galat.message).toMatch(/Kuota dari Admin Pusat: 100 siswa/);
    expect(galat.message).toMatch(/terdaftar: 95 siswa/);
    expect(galat.message).toMatch(/sisa kuota: 5 siswa/);
  });

  it("masa tenggang masih dihitung berjalan: siswa baru masih bisa ditambahkan", async () => {
    m.periode.mockResolvedValue([periode("2025-09-01", "2026-02-28", 100)]); // 1 Maret = hari pertama tenggang
    await expect(assertKuotaTersedia("sch-1", 1)).resolves.toBeUndefined();
  });

  it("periode berikutnya sudah dijadwalkan tapi belum mulai: kuotanya dipakai (menyiapkan siswa baru lebih awal)", async () => {
    m.periode.mockResolvedValue([periode("2026-07-01", "2026-12-31", 30)]);
    m.jumlahSiswa.mockResolvedValue(30);
    await expect(assertKuotaTersedia("sch-1", 1)).rejects.toThrow(/sisa kuota: 0 siswa/);
  });

  it("kolom lama di tabel sekolah tidak lagi menentukan: hanya periode yang dibaca", async () => {
    m.sekolah.mockResolvedValue({ id: "sch-1", seatQuota: 9999, validUntil: new Date("2099-01-01") });
    m.periode.mockResolvedValue([]);
    await expect(assertKuotaTersedia("sch-1", 1)).rejects.toBeInstanceOf(KuotaPenuhError);
  });
});

describe("schoolCreateSchema - kuota dan masa berlaku berpasangan", () => {
  const dasar = { nama: "SMP Uji", jenjang: "SMP" as const };

  it("tanpa keduanya, atau dengan keduanya, sah", () => {
    expect(schoolCreateSchema.safeParse(dasar).success).toBe(true);
    expect(schoolCreateSchema.safeParse({ ...dasar, seatQuota: 100, validUntil: "2026-12-31" }).success).toBe(true);
    expect(schoolCreateSchema.safeParse({ ...dasar, seatQuota: undefined, validUntil: "" }).success).toBe(true);
  });

  it("hanya kuota atau hanya tanggal ditolak", () => {
    const hanyaKuota = schoolCreateSchema.safeParse({ ...dasar, seatQuota: 100 });
    expect(hanyaKuota.success).toBe(false);
    if (!hanyaKuota.success) expect(hanyaKuota.error.issues[0]!.path).toEqual(["validUntil"]);

    const hanyaTanggal = schoolCreateSchema.safeParse({ ...dasar, validUntil: "2026-12-31" });
    expect(hanyaTanggal.success).toBe(false);
    if (!hanyaTanggal.success) expect(hanyaTanggal.error.issues[0]!.path).toEqual(["seatQuota"]);
  });

  it("tanggal yang tidak ada di kalender ditolak", () => {
    for (const salah of ["2026-02-31", "2026-13-01", "31-12-2026", "besok"]) {
      expect(schoolCreateSchema.safeParse({ ...dasar, seatQuota: 10, validUntil: salah }).success).toBe(false);
    }
  });
});

describe("schoolUpdateSchema - mengubah data sekolah tidak menyentuh kuota/masa berlaku/akun admin", () => {
  it("membuang kolom kuota, masa berlaku, dan akun admin, mempertahankan sisanya", () => {
    const hasil = schoolUpdateSchema.parse({
      nama: "SMP Baru",
      seatQuota: 9999,
      validUntil: "2099-01-01",
      adminEmail: "x@y.id",
      adminNama: "Orang",
    });
    expect(hasil).toEqual({ nama: "SMP Baru" });
  });

  it("status sekolah tetap bisa diubah dan divalidasi", () => {
    expect(schoolUpdateSchema.parse({ status: "suspend" })).toEqual({ status: "suspend" });
    expect(schoolUpdateSchema.safeParse({ status: "kedaluwarsa" }).success).toBe(false);
  });
});
