import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  hitungOpsi: vi.fn(),
}));

vi.mock("@/lib/billing/la-susulan", () => ({ hitungOpsiLaSusulan: m.hitungOpsi }));

import { bisaLihatFokusBelajar, type OpsiLaSusulan } from "@/lib/billing/learning-analytics";
import { hitungFokusBelajarDibuka } from "@/lib/billing/fokus-belajar";

const kuota = (o: Partial<Extract<OpsiLaSusulan, { pendanaan: "kuota" }>> = {}): OpsiLaSusulan => ({
  tersedia: true,
  pendanaan: "kuota",
  kuotaSisa: 1,
  batasTercapai: false,
  batasMaks: 3,
  ...o,
});
const saldo = (o: Partial<Extract<OpsiLaSusulan, { pendanaan: "saldo" }>> = {}): OpsiLaSusulan => ({
  tersedia: true,
  pendanaan: "saldo",
  harga: 5500,
  saldo: 6000,
  cukup: true,
  kurang: 0,
  ...o,
});
const saldoKurang = (o: Partial<Extract<OpsiLaSusulan, { pendanaan: "saldo" }>> = {}) => saldo({ saldo: 1000, cukup: false, kurang: 4500, ...o });

// Aturan pemilik (16 dan 17 Okt 2026): kedua kartu fitur berbayar ini tampil HANYA bila Learning Analytics sudah
// DIAKTIFKAN untuk percobaan ini. Punya jatah atau saldo saja tidak cukup.
describe("bisaLihatFokusBelajar (aturan: Learning Analytics sudah diaktifkan)", () => {
  it.each<[string, OpsiLaSusulan | null | undefined, boolean]>([
    ["analisis sudah ada: dibuka", { tersedia: false, alasan: "sudah_ada" }, true],
    ["analisis sedang diproses (baru diaktifkan): dibuka", { tersedia: false, alasan: "sedang_diproses" }, true],
    ["Try Out Nasional (Learning Analytics dibundel): dibuka", { tersedia: false, alasan: "nasional" }, true],
    ["percobaan belum selesai: tertutup", { tersedia: false, alasan: "belum_selesai" }, false],
    ["opsi tidak diketahui (server gagal menghitung): tertutup, tidak bisa dipastikan aktif", null, false],
    ["opsi tidak ada pada respons lama: tertutup", undefined, false],
    // Kasus yang dilaporkan pemilik 17 Okt: punya jatah tetapi belum menekan "Lakukan Learning Analytics"
    ["jatah paket masih ada tetapi BELUM diaktifkan: tertutup", kuota(), false],
    ["jatah ada, batas per mapel tercapai, belum diaktifkan: tertutup", kuota({ batasTercapai: true }), false],
    ["saldo cukup tetapi BELUM diaktifkan: tertutup", saldo(), false],
    ["saldo pas sebesar harga tetapi belum diaktifkan: tertutup", saldo({ saldo: 5500, kurang: 0 }), false],
    ["saldo kurang dan belum diaktifkan: tertutup", saldoKurang(), false],
    ["tanpa jatah dan tanpa saldo (0): tertutup", saldoKurang({ saldo: 0, kurang: 5500 }), false],
    ["siswa sekolah bersaldo 0 (tidak bisa beli paket): tertutup", saldoKurang({ saldo: 0, kurang: 5000, bisaBeliPaket: false }), false],
  ])("%s", (_nama, opsi, harapan) => {
    expect(bisaLihatFokusBelajar(opsi)).toBe(harapan);
  });
});

describe("hitungFokusBelajarDibuka (server)", () => {
  const ATTEMPT = {
    id: "att-1",
    studentId: "s-1",
    status: "selesai",
    analisisAiDiminta: false,
    mulaiAt: new Date("2026-10-16T01:00:00Z"),
  };
  const attempt = (o: Record<string, unknown> = {}) => ({ ...ATTEMPT, ...o }) as never;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("opsi yang diteruskan dipakai apa adanya, tanpa dihitung ulang", async () => {
    await expect(hitungFokusBelajarDibuka(attempt(), { tersedia: false, alasan: "sudah_ada" })).resolves.toBe(true);
    await expect(hitungFokusBelajarDibuka(attempt(), { tersedia: false, alasan: "sedang_diproses" })).resolves.toBe(true);
    await expect(hitungFokusBelajarDibuka(attempt(), saldo())).resolves.toBe(false);
    await expect(hitungFokusBelajarDibuka(attempt(), kuota())).resolves.toBe(false);
    await expect(hitungFokusBelajarDibuka(attempt(), null)).resolves.toBe(false);
    expect(m.hitungOpsi).not.toHaveBeenCalled();
  });

  it("punya jatah atau saldo tetapi belum mengaktifkan Learning Analytics: tertutup, juga untuk siswa sekolah", async () => {
    await expect(hitungFokusBelajarDibuka(attempt(), kuota({ kuotaSisa: 1 }))).resolves.toBe(false);
    await expect(hitungFokusBelajarDibuka(attempt(), saldo({ saldo: 100000, kurang: 0 }))).resolves.toBe(false);
    await expect(hitungFokusBelajarDibuka(attempt(), saldoKurang({ saldo: 0, kurang: 5000, bisaBeliPaket: false }))).resolves.toBe(false);
  });

  it("diminta saat ujian dimulai tetapi analisisnya belum masuk antrean: sudah dianggap aktif", async () => {
    await expect(hitungFokusBelajarDibuka(attempt({ analisisAiDiminta: true }), saldo())).resolves.toBe(true);
    await expect(hitungFokusBelajarDibuka(attempt({ analisisAiDiminta: true, status: "kedaluwarsa" }), kuota())).resolves.toBe(true);
  });

  it("diminta tetapi percobaan belum selesai: tertutup", async () => {
    await expect(hitungFokusBelajarDibuka(attempt({ analisisAiDiminta: true, status: "berjalan" }), { tersedia: false, alasan: "belum_selesai" })).resolves.toBe(false);
  });

  it("opsi tidak diteruskan: dihitung dari percobaan itu lalu dipakai", async () => {
    m.hitungOpsi.mockResolvedValue({ tersedia: false, alasan: "sudah_ada" });
    await expect(hitungFokusBelajarDibuka(attempt())).resolves.toBe(true);
    expect(m.hitungOpsi).toHaveBeenCalledWith(attempt());

    m.hitungOpsi.mockResolvedValue(saldoKurang());
    await expect(hitungFokusBelajarDibuka(attempt())).resolves.toBe(false);
  });

  it("penjaga: aturan tidak menanyakan tipe akses siswa (tidak ada pengecualian sekolah/langganan yang membuka kartu)", () => {
    const sumber = readFileSync(join(process.cwd(), "lib/billing/fokus-belajar.ts"), "utf8");
    expect(sumber).not.toMatch(/akses-ujian|getTipeAkses|@\/lib\/db\/prisma/);
  });

  it("opsi gagal dihitung: tertutup dan galat dicatat di log (tidak melempar)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.hitungOpsi.mockRejectedValue(new Error("DB putus"));
    await expect(hitungFokusBelajarDibuka(attempt())).resolves.toBe(false);
    expect(vi.mocked(console.error).mock.calls.some((c) => String(c[0]).includes("fokus-belajar"))).toBe(true);
  });

  it("opsi gagal dihitung tetapi Learning Analytics diminta saat ujian: tetap terbuka", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.hitungOpsi.mockRejectedValue(new Error("DB putus"));
    await expect(hitungFokusBelajarDibuka(attempt({ analisisAiDiminta: true }))).resolves.toBe(true);
  });
});
