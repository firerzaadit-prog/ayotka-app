import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ cari: vi.fn(), upsert: vi.fn(), cariSoal: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { hargaLaPengaturan: { findUnique: m.cari, upsert: m.upsert }, question: { findMany: m.cariSoal } },
}));

import { getBebanAiPaket, getHargaLaPaket, getKonfigHargaLA, simpanKonfigHargaLA, tabelHargaLaBelumAda } from "@/lib/billing/saldo";
import { taksirBebanAi } from "@/lib/billing/beban-ai";

const galatPrisma = (code: string) => Object.assign(new Error(`galat ${code}`), { code });
const baris = (o: Record<string, unknown> = {}) => ({ id: "global", hargaMin: 4_500, hargaMaks: 7_500, bebanRingan: 6_500, bebanBerat: 13_500, updatedAt: new Date(), ...o });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("getKonfigHargaLA", () => {
  it("memakai pengaturan tersimpan", async () => {
    m.cari.mockResolvedValue(baris({ hargaMin: 5_000, hargaMaks: 9_000, bebanRingan: 5_000, bebanBerat: 20_000 }));
    expect(await getKonfigHargaLA()).toEqual({ hargaMin: 5_000, hargaMaks: 9_000, bebanRingan: 5_000, bebanBerat: 20_000 });
    expect(m.cari).toHaveBeenCalledWith({ where: { id: "global" } });
  });

  it("belum ada baris: nilai bawaan (Rp4.500-Rp7.500, 6.500 dan 13.500 token)", async () => {
    m.cari.mockResolvedValue(null);
    expect(await getKonfigHargaLA()).toEqual({ hargaMin: 4_500, hargaMaks: 7_500, bebanRingan: 6_500, bebanBerat: 13_500 });
  });

  it("baris rusak (diubah langsung di database): nilai bawaan seluruhnya", async () => {
    m.cari.mockResolvedValue(baris({ hargaMin: 9_000, hargaMaks: 1_000 }));
    expect(await getKonfigHargaLA()).toEqual({ hargaMin: 4_500, hargaMaks: 7_500, bebanRingan: 6_500, bebanBerat: 13_500 });
  });

  it("tabel belum ada (migrasi belum diterapkan, P2021): nilai bawaan, pembayaran tidak macet, peringatan dicatat sekali", async () => {
    m.cari.mockRejectedValue(galatPrisma("P2021"));
    expect(await getKonfigHargaLA()).toEqual({ hargaMin: 4_500, hargaMaks: 7_500, bebanRingan: 6_500, bebanBerat: 13_500 });
    expect(await getKonfigHargaLA()).toEqual({ hargaMin: 4_500, hargaMaks: 7_500, bebanRingan: 6_500, bebanBerat: 13_500 });
    expect(vi.mocked(console.warn).mock.calls.filter((c) => String(c[0]).includes("harga_la_pengaturan"))).toHaveLength(1);
  });

  it("galat database lain DILEMPAR (lebih baik gagal daripada menagih dengan harga yang salah)", async () => {
    m.cari.mockRejectedValue(galatPrisma("P1001"));
    await expect(getKonfigHargaLA()).rejects.toThrow("P1001");
    m.cari.mockRejectedValue(new Error("koneksi putus"));
    await expect(getKonfigHargaLA()).rejects.toThrow("koneksi putus");
  });
});

describe("tabelHargaLaBelumAda", () => {
  it("hanya P2021", () => {
    expect(tabelHargaLaBelumAda(galatPrisma("P2021"))).toBe(true);
    for (const e of [galatPrisma("P2002"), galatPrisma("P1001"), new Error("x"), null, undefined, "P2021", 5]) expect(tabelHargaLaBelumAda(e)).toBe(false);
  });
});

/** Soal berukuran biasa: teks 300 karakter, 4 pilihan @40 karakter, pembahasan 500 karakter (790 karakter prompt per soal). */
const soalBiasa = (n: number, o: Record<string, unknown> = {}) =>
  Array.from({ length: n }, () => ({
    teks: "a".repeat(300),
    pembahasan: "b".repeat(500),
    options: Array.from({ length: 4 }, () => ({ teks: "c".repeat(40) })),
    statements: [],
    ...o,
  }));

describe("getBebanAiPaket / getHargaLaPaket", () => {
  beforeEach(() => {
    m.cari.mockResolvedValue(null);
  });

  it("beban dihitung dari isi soal paket yang belum dihapus (teks, pembahasan, pilihan, pernyataan)", async () => {
    m.cariSoal.mockResolvedValue([
      { teks: "Soal satu", pembahasan: "Karena begitu", options: [{ teks: "A" }, { teks: "B" }], statements: [] },
      { teks: "Soal dua", pembahasan: null, options: [], statements: [{ teks: "Pernyataan 1" }, { teks: "Pernyataan 2" }] },
    ]);
    const diharapkan = taksirBebanAi([
      { teks: "Soal satu", pembahasan: "Karena begitu", opsi: ["A", "B"] },
      { teks: "Soal dua", pembahasan: null, opsi: ["Pernyataan 1", "Pernyataan 2"] },
    ]);
    expect(await getBebanAiPaket("paket-1")).toBe(diharapkan);
    expect(m.cariSoal).toHaveBeenCalledWith({
      where: { packageId: "paket-1", deletedAt: null },
      select: { teks: true, pembahasan: true, options: { select: { teks: true } }, statements: { select: { teks: true } } },
    });
  });

  it("harga mengikuti isi paket: 30 soal biasa = Rp5.500, 50 soal biasa = Rp7.500", async () => {
    m.cariSoal.mockResolvedValue(soalBiasa(30));
    expect(await getHargaLaPaket("paket-1")).toBe(5_500);
    m.cariSoal.mockResolvedValue(soalBiasa(50));
    expect(await getHargaLaPaket("paket-1")).toBe(7_500);
  });

  it("jumlah soal sama tetapi isinya lebih panjang = lebih mahal (bukan sekadar hitung soal)", async () => {
    m.cariSoal.mockResolvedValue(soalBiasa(30));
    const biasa = await getHargaLaPaket("p");
    m.cariSoal.mockResolvedValue(soalBiasa(30, { pembahasan: "b".repeat(1_500), teks: "a".repeat(900) }));
    const panjang = await getHargaLaPaket("p");
    expect(panjang).toBeGreaterThan(biasa);
    m.cariSoal.mockResolvedValue(soalBiasa(30, { pembahasan: null, teks: "a" }));
    expect(await getHargaLaPaket("p")).toBeLessThan(biasa);
  });

  it("paket kecil = termurah, paket besar = termahal, paket kosong = termurah", async () => {
    m.cariSoal.mockResolvedValue(soalBiasa(10));
    expect(await getHargaLaPaket("p")).toBe(4_500);
    m.cariSoal.mockResolvedValue(soalBiasa(80));
    expect(await getHargaLaPaket("p")).toBe(7_500);
    m.cariSoal.mockResolvedValue([]);
    expect(await getHargaLaPaket("p")).toBe(4_500);
  });

  it("mengikuti pengaturan admin", async () => {
    m.cari.mockResolvedValue(baris({ hargaMin: 6_000, hargaMaks: 6_000 }));
    m.cariSoal.mockResolvedValue(soalBiasa(35));
    expect(await getHargaLaPaket("p")).toBe(6_000);
    // batas ringan/berat diubah admin: 30 soal biasa (sekitar 8.900 token) kini melewati batas berat 8.000 -> harga maksimum
    m.cari.mockResolvedValue(baris({ bebanRingan: 4_000, bebanBerat: 8_000 }));
    m.cariSoal.mockResolvedValue(soalBiasa(30));
    expect(await getHargaLaPaket("p")).toBe(7_500);
  });

  it("tabel belum ada: tetap berharga lewat nilai bawaan", async () => {
    m.cari.mockRejectedValue(galatPrisma("P2021"));
    m.cariSoal.mockResolvedValue(soalBiasa(40));
    expect(await getHargaLaPaket("p")).toBe(6_500);
  });

  it("galat membaca soal dilempar (tidak menagih dengan harga tebakan)", async () => {
    m.cariSoal.mockRejectedValue(new Error("koneksi putus"));
    await expect(getHargaLaPaket("p")).rejects.toThrow("koneksi putus");
  });
});

describe("simpanKonfigHargaLA", () => {
  it("menyimpan (upsert baris global) dan mengembalikan hasil yang sudah diperiksa", async () => {
    m.upsert.mockResolvedValue(baris({ hargaMin: 5_000, hargaMaks: 8_000, bebanRingan: 4_000, bebanBerat: 15_000 }));
    const hasil = await simpanKonfigHargaLA({ hargaMin: 5_000, hargaMaks: 8_000, bebanRingan: 4_000, bebanBerat: 15_000 });
    expect(hasil).toEqual({ hargaMin: 5_000, hargaMaks: 8_000, bebanRingan: 4_000, bebanBerat: 15_000 });
    expect(m.upsert).toHaveBeenCalledWith({
      where: { id: "global" },
      create: { id: "global", hargaMin: 5_000, hargaMaks: 8_000, bebanRingan: 4_000, bebanBerat: 15_000 },
      update: { hargaMin: 5_000, hargaMaks: 8_000, bebanRingan: 4_000, bebanBerat: 15_000 },
    });
  });

  it("galat database dilempar apa adanya", async () => {
    m.upsert.mockRejectedValue(galatPrisma("P2021"));
    await expect(simpanKonfigHargaLA({ hargaMin: 5_000, hargaMaks: 8_000, bebanRingan: 4_000, bebanBerat: 15_000 })).rejects.toMatchObject({ code: "P2021" });
  });
});
