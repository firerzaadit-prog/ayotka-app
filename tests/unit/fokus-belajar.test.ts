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

describe("bisaLihatFokusBelajar (aturan: ada jatah atau saldo Learning Analytics)", () => {
  it.each<[string, OpsiLaSusulan | null | undefined, boolean]>([
    ["opsi tidak diketahui (server gagal menghitung): dibuka agar gangguan sesaat tidak menyembunyikan fitur", null, true],
    ["opsi tidak ada pada respons lama: dibuka", undefined, true],
    ["analisis sudah ada (sudah dibayar): dibuka", { tersedia: false, alasan: "sudah_ada" }, true],
    ["analisis sedang diproses (sudah dipesan): dibuka", { tersedia: false, alasan: "sedang_diproses" }, true],
    ["Try Out Nasional (LA dibundel): dibuka", { tersedia: false, alasan: "nasional" }, true],
    ["percobaan belum selesai: tidak ada yang dibuka", { tersedia: false, alasan: "belum_selesai" }, false],
    ["jatah paket masih ada: dibuka", kuota(), true],
    ["jatah ada tetapi batas analisis per mapel sudah tercapai: tertutup", kuota({ batasTercapai: true }), false],
    ["saldo cukup untuk satu analisis: dibuka", saldo(), true],
    ["saldo pas sebesar harga: dibuka", saldo({ saldo: 5500, kurang: 0 }), true],
    ["saldo kurang: tertutup", saldoKurang(), false],
    ["tanpa jatah dan tanpa saldo (0): tertutup", saldoKurang({ saldo: 0, kurang: 5500 }), false],
    ["saldo kurang dan tidak bisa beli paket (ditanggung sekolah): tertutup oleh aturan murni", saldoKurang({ bisaBeliPaket: false }), false],
    ["saldo kurang dan bisa beli paket: tertutup (jalan keluarnya membeli paket/isi saldo)", saldoKurang({ bisaBeliPaket: true }), false],
  ])("%s", (_nama, opsi, harapan) => {
    expect(bisaLihatFokusBelajar(opsi)).toBe(harapan);
  });
});

describe("hitungFokusBelajarDibuka (server)", () => {
  const ATTEMPT = { id: "att-1", studentId: "s-1", mulaiAt: new Date("2026-10-16T01:00:00Z") } as never;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("opsi yang diteruskan dipakai apa adanya, tanpa dihitung ulang", async () => {
    await expect(hitungFokusBelajarDibuka(ATTEMPT, saldo())).resolves.toBe(true);
    await expect(hitungFokusBelajarDibuka(ATTEMPT, kuota())).resolves.toBe(true);
    await expect(hitungFokusBelajarDibuka(ATTEMPT, null)).resolves.toBe(true);
    await expect(hitungFokusBelajarDibuka(ATTEMPT, saldoKurang())).resolves.toBe(false);
    expect(m.hitungOpsi).not.toHaveBeenCalled();
  });

  it("tanpa jatah dan saldo: tertutup, termasuk untuk siswa sekolah (opsi LA sama persis dengan yang dilihat kartu LA)", async () => {
    // Bentuk opsi untuk siswa sekolah bersaldo 0: kartu LA menagih Rp 5.000 dan menawarkan "Isi saldo" (bisaBeliPaket
    // false karena kursi sekolah menanggung akses). Kartu fokus tidak boleh terbuka selama kartu LA itu masih menagih.
    await expect(hitungFokusBelajarDibuka(ATTEMPT, saldoKurang({ saldo: 0, harga: 5000, kurang: 5000, bisaBeliPaket: false }))).resolves.toBe(false);
    await expect(hitungFokusBelajarDibuka(ATTEMPT, kuota({ batasTercapai: true }))).resolves.toBe(false);
  });

  it("siswa sekolah yang analisisnya sudah ada atau sedang diproses: dibuka", async () => {
    await expect(hitungFokusBelajarDibuka(ATTEMPT, { tersedia: false, alasan: "sudah_ada" })).resolves.toBe(true);
    await expect(hitungFokusBelajarDibuka(ATTEMPT, { tersedia: false, alasan: "sedang_diproses" })).resolves.toBe(true);
  });

  it("opsi tidak diteruskan: dihitung dari percobaan itu lalu dipakai", async () => {
    m.hitungOpsi.mockResolvedValue(saldo());
    await expect(hitungFokusBelajarDibuka(ATTEMPT)).resolves.toBe(true);
    expect(m.hitungOpsi).toHaveBeenCalledWith(ATTEMPT);

    m.hitungOpsi.mockResolvedValue(saldoKurang());
    await expect(hitungFokusBelajarDibuka(ATTEMPT)).resolves.toBe(false);
  });

  it("penjaga: aturan tidak menanyakan tipe akses siswa (tidak ada pengecualian sekolah/langganan yang membuka kartu)", () => {
    const sumber = readFileSync(join(process.cwd(), "lib/billing/fokus-belajar.ts"), "utf8");
    expect(sumber).not.toMatch(/akses-ujian|getTipeAkses|@\/lib\/db\/prisma/);
  });

  it("opsi gagal dihitung: dibuka dan galat dicatat di log (tidak melempar)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.hitungOpsi.mockRejectedValue(new Error("DB putus"));
    await expect(hitungFokusBelajarDibuka(ATTEMPT)).resolves.toBe(true);
    expect(vi.mocked(console.error).mock.calls.some((c) => String(c[0]).includes("fokus-belajar"))).toBe(true);
  });
});
