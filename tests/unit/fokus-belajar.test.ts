import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  studentFindUnique: vi.fn(),
  getTipeAkses: vi.fn(),
  hitungOpsi: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { student: { findUnique: m.studentFindUnique } } }));
vi.mock("@/lib/billing/akses-ujian", () => ({ getTipeAkses: m.getTipeAkses }));
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
    m.studentFindUnique.mockResolvedValue({ id: "s-1", schoolId: "sek-1", jalur: "A", deletedAt: null, lulusAt: null });
    m.getTipeAkses.mockResolvedValue("gratis");
  });

  it("jalan cepat: opsi yang diteruskan sudah cukup untuk membuka, tanpa kueri tambahan", async () => {
    await expect(hitungFokusBelajarDibuka(ATTEMPT, saldo())).resolves.toBe(true);
    await expect(hitungFokusBelajarDibuka(ATTEMPT, kuota())).resolves.toBe(true);
    await expect(hitungFokusBelajarDibuka(ATTEMPT, null)).resolves.toBe(true);
    expect(m.hitungOpsi).not.toHaveBeenCalled();
    expect(m.studentFindUnique).not.toHaveBeenCalled();
    expect(m.getTipeAkses).not.toHaveBeenCalled();
  });

  it("tanpa jatah dan saldo, siswa gratis: tertutup", async () => {
    await expect(hitungFokusBelajarDibuka(ATTEMPT, saldoKurang())).resolves.toBe(false);
    expect(m.getTipeAkses).toHaveBeenCalledTimes(1);
  });

  it("tanpa jatah dan saldo, siswa berlangganan yang jatahnya habis: tertutup", async () => {
    m.getTipeAkses.mockResolvedValue("langganan");
    await expect(hitungFokusBelajarDibuka(ATTEMPT, saldoKurang({ saldo: 0, kurang: 5500 }))).resolves.toBe(false);
  });

  it("akses yang ditanggung sekolah tetap dibuka walau siswa tidak punya saldo atau jatah", async () => {
    m.getTipeAkses.mockResolvedValue("sekolah");
    await expect(hitungFokusBelajarDibuka(ATTEMPT, saldoKurang({ bisaBeliPaket: false }))).resolves.toBe(true);
    await expect(hitungFokusBelajarDibuka(ATTEMPT, kuota({ batasTercapai: true }))).resolves.toBe(true);
  });

  it("opsi tidak diteruskan: dihitung dari percobaan itu lalu dipakai", async () => {
    m.hitungOpsi.mockResolvedValue(saldo());
    await expect(hitungFokusBelajarDibuka(ATTEMPT)).resolves.toBe(true);
    expect(m.hitungOpsi).toHaveBeenCalledWith(ATTEMPT);

    m.hitungOpsi.mockResolvedValue(saldoKurang());
    await expect(hitungFokusBelajarDibuka(ATTEMPT)).resolves.toBe(false);
  });

  it("opsi gagal dihitung: dibuka dan galat dicatat di log (tidak melempar)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.hitungOpsi.mockRejectedValue(new Error("DB putus"));
    await expect(hitungFokusBelajarDibuka(ATTEMPT)).resolves.toBe(true);
    expect(vi.mocked(console.error).mock.calls.some((c) => String(c[0]).includes("fokus-belajar"))).toBe(true);
  });

  it("siswa tidak ditemukan atau pemeriksaan akses gagal: dibuka (tidak menghukum siswa karena gangguan)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.studentFindUnique.mockResolvedValue(null);
    await expect(hitungFokusBelajarDibuka(ATTEMPT, saldoKurang())).resolves.toBe(true);

    m.studentFindUnique.mockResolvedValue({ id: "s-1" });
    m.getTipeAkses.mockRejectedValue(new Error("DB putus"));
    await expect(hitungFokusBelajarDibuka(ATTEMPT, saldoKurang())).resolves.toBe(true);
    expect(vi.mocked(console.error).mock.calls.some((c) => String(c[0]).includes("akses sekolah"))).toBe(true);
  });
});
