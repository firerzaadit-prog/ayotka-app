import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ aggregate: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { aiAnalysis: { aggregate: m.aggregate } } }));

import { kolomTokenBelumAda, muatKalibrasiAi } from "@/lib/billing/kalibrasi-ai";
import {
  HARI_KALIBRASI,
  MINIMAL_ANALISIS_KALIBRASI,
  hitungRasioKalibrasi,
  kesimpulanKalibrasi,
  type KalibrasiAi,
} from "@/lib/billing/kalibrasi-tampilan";

const galat = (code: string) => Object.assign(new Error(`galat ${code}`), { code });
const SEKARANG = new Date("2026-10-13T03:00:00.000Z");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("muatKalibrasiAi", () => {
  it("meringkas analisis 30 hari terakhir yang tokennya tercatat: rata-rata, total, dan rasio nyata/taksiran", async () => {
    m.aggregate.mockResolvedValue({
      _count: { _all: 25 },
      _avg: { tokenMasuk: 9_600.4, tokenKeluar: 810.5, taksiranTokenMasuk: 8_000 },
      _sum: { tokenMasuk: 240_010, tokenKeluar: 20_262 },
    });
    const k = await muatKalibrasiAi(SEKARANG);
    expect(k).toEqual({
      hari: 30,
      jumlah: 25,
      rataTokenMasuk: 9_600,
      rataTokenKeluar: 811,
      rataTaksiran: 8_000,
      rasio: 1.2,
      totalTokenMasuk: 240_010,
      totalTokenKeluar: 20_262,
    });
  });

  it("hanya baris yang token dan taksirannya tercatat, dalam jendela 30 hari", async () => {
    m.aggregate.mockResolvedValue({ _count: { _all: 0 }, _avg: { tokenMasuk: null, tokenKeluar: null, taksiranTokenMasuk: null }, _sum: { tokenMasuk: null, tokenKeluar: null } });
    await muatKalibrasiAi(SEKARANG);
    const arg = m.aggregate.mock.calls[0]![0];
    expect(arg.where.tokenMasuk).toEqual({ not: null });
    expect(arg.where.taksiranTokenMasuk).toEqual({ not: null });
    expect(arg.where.generatedAt.gte.toISOString()).toBe("2026-09-13T03:00:00.000Z");
    expect(HARI_KALIBRASI).toBe(30);
  });

  it("belum ada data: jumlah 0, semua rata-rata null, rasio null, total 0 (bukan NaN)", async () => {
    m.aggregate.mockResolvedValue({ _count: { _all: 0 }, _avg: { tokenMasuk: null, tokenKeluar: null, taksiranTokenMasuk: null }, _sum: { tokenMasuk: null, tokenKeluar: null } });
    expect(await muatKalibrasiAi(SEKARANG)).toEqual({
      hari: 30,
      jumlah: 0,
      rataTokenMasuk: null,
      rataTokenKeluar: null,
      rataTaksiran: null,
      rasio: null,
      totalTokenMasuk: 0,
      totalTokenKeluar: 0,
    });
  });

  it("migrasi belum diterapkan (tabel/kolom tidak ada): null, tidak melempar galat", async () => {
    m.aggregate.mockRejectedValue(galat("P2022"));
    expect(await muatKalibrasiAi(SEKARANG)).toBeNull();
    m.aggregate.mockRejectedValue(galat("P2021"));
    expect(await muatKalibrasiAi(SEKARANG)).toBeNull();
  });

  it("galat database lain dilempar (tidak ditelan jadi 'belum ada data')", async () => {
    m.aggregate.mockRejectedValue(galat("P1001"));
    await expect(muatKalibrasiAi(SEKARANG)).rejects.toThrow("P1001");
  });
});

describe("kolomTokenBelumAda", () => {
  it("hanya P2021 dan P2022", () => {
    expect(kolomTokenBelumAda(galat("P2021"))).toBe(true);
    expect(kolomTokenBelumAda(galat("P2022"))).toBe(true);
    for (const e of [galat("P2002"), galat("P1001"), new Error("x"), null, undefined, "P2022", 5]) expect(kolomTokenBelumAda(e)).toBe(false);
  });
});

describe("hitungRasioKalibrasi", () => {
  it("nyata dibagi taksiran, dua desimal; tidak ada data atau taksiran nol = null", () => {
    expect(hitungRasioKalibrasi(9_600, 8_000)).toBe(1.2);
    expect(hitungRasioKalibrasi(7_000, 8_000)).toBe(0.88);
    expect(hitungRasioKalibrasi(8_000, 8_000)).toBe(1);
    expect(hitungRasioKalibrasi(null, 8_000)).toBeNull();
    expect(hitungRasioKalibrasi(8_000, null)).toBeNull();
    expect(hitungRasioKalibrasi(8_000, 0)).toBeNull();
    expect(hitungRasioKalibrasi(8_000, -5)).toBeNull();
  });
});

describe("kesimpulanKalibrasi", () => {
  const dasar: KalibrasiAi = { hari: 30, jumlah: 40, rataTokenMasuk: 8_000, rataTokenKeluar: 800, rataTaksiran: 8_000, rasio: 1, totalTokenMasuk: 320_000, totalTokenKeluar: 32_000 };

  it("tanpa data: penjelasan, dan dianggap belum cukup", () => {
    for (const k of [null, { ...dasar, jumlah: 0 }]) {
      const r = kesimpulanKalibrasi(k);
      expect(r.cukup).toBe(false);
      expect(r.teks).toContain("Belum ada analisis yang tercatat tokennya");
    }
  });

  it("rasio dalam toleransi 15%: taksiran dibilang cukup tepat", () => {
    for (const rasio of [0.85, 0.9, 1, 1.1, 1.15]) {
      const r = kesimpulanKalibrasi({ ...dasar, rasio });
      expect(r.teks, String(rasio)).toContain("sudah cukup tepat");
      expect(r.cukup).toBe(true);
    }
  });

  it("di atas toleransi: pemakaian nyata LEBIH BESAR; di bawah: LEBIH KECIL, dengan persen selisih", () => {
    expect(kesimpulanKalibrasi({ ...dasar, rasio: 1.3 }).teks).toContain("30% LEBIH BESAR dari taksiran");
    expect(kesimpulanKalibrasi({ ...dasar, rasio: 0.7 }).teks).toContain("30% LEBIH KECIL dari taksiran");
    expect(kesimpulanKalibrasi({ ...dasar, rasio: 1.16 }).teks).toContain("LEBIH BESAR");
    expect(kesimpulanKalibrasi({ ...dasar, rasio: 0.84 }).teks).toContain("LEBIH KECIL");
  });

  it("jumlah analisis di bawah minimal: ada peringatan dan 'cukup' false; tepat minimal = cukup", () => {
    const sedikit = kesimpulanKalibrasi({ ...dasar, jumlah: MINIMAL_ANALISIS_KALIBRASI - 1, rasio: 1.4 });
    expect(sedikit.cukup).toBe(false);
    expect(sedikit.teks).toContain(`Baru ${MINIMAL_ANALISIS_KALIBRASI - 1} analisis tercatat`);
    const pas = kesimpulanKalibrasi({ ...dasar, jumlah: MINIMAL_ANALISIS_KALIBRASI, rasio: 1.4 });
    expect(pas.cukup).toBe(true);
    expect(pas.teks).not.toContain("Baru");
  });

  it("rasio tidak bisa dihitung: pesan tersendiri, bukan 'NaN%'", () => {
    const r = kesimpulanKalibrasi({ ...dasar, rasio: null });
    expect(r.teks).toContain("belum bisa dibandingkan");
    expect(r.teks).not.toContain("NaN");
  });
});
