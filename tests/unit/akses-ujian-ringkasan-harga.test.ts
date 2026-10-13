import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  getActiveEntitlement: vi.fn(),
  hasUsedFreeTrial: vi.fn(),
  kursiSekolahTersedia: vi.fn(),
  getAiKuotaRemaining: vi.fn(),
  getSaldo: vi.fn(),
  getHargaLaPaket: vi.fn(),
}));

vi.mock("@/lib/billing/entitlements", () => ({
  getActiveEntitlement: m.getActiveEntitlement,
  hasUsedFreeTrial: m.hasUsedFreeTrial,
  kursiSekolahTersedia: m.kursiSekolahTersedia,
}));
vi.mock("@/lib/billing/plan-fitur", () => ({ getAiKuotaRemaining: m.getAiKuotaRemaining }));
vi.mock("@/lib/billing/saldo", () => ({ getSaldo: m.getSaldo, getHargaLaPaket: m.getHargaLaPaket }));

import { getRingkasanAksesUjian } from "@/lib/billing/akses-ujian";

const SISWA = { id: "siswa-1" } as never;
const MAPEL = { id: "mat", nama: "Matematika" };

beforeEach(() => {
  vi.resetAllMocks();
  m.getActiveEntitlement.mockResolvedValue(null);
  m.kursiSekolahTersedia.mockResolvedValue(false);
  m.hasUsedFreeTrial.mockResolvedValue(false);
  m.getSaldo.mockResolvedValue(10_000);
  m.getAiKuotaRemaining.mockResolvedValue(null);
});

describe("getRingkasanAksesUjian - harga Learning Analytics per paket", () => {
  it("siswa gratis: harga dihitung untuk paket yang dipilih", async () => {
    m.getHargaLaPaket.mockImplementation(async (id: string) => (id === "paket-besar" ? 7_500 : 4_500));
    expect((await getRingkasanAksesUjian(SISWA, MAPEL, "paket-besar")).learningAnalytics).toEqual({ harga: 7_500, saldo: 10_000, kuota: null });
    expect((await getRingkasanAksesUjian(SISWA, MAPEL, "paket-kecil")).learningAnalytics).toEqual({ harga: 4_500, saldo: 10_000, kuota: null });
    expect(m.getHargaLaPaket).toHaveBeenCalledWith("paket-besar");
    expect(m.getHargaLaPaket).toHaveBeenCalledWith("paket-kecil");
  });

  it("siswa berlangganan: harga paket dan sisa jatah dua-duanya ada", async () => {
    m.getActiveEntitlement.mockResolvedValue({ canStartNewAttempt: true, entitlement: { source: "invoice" } });
    m.getAiKuotaRemaining.mockResolvedValue({ sisa: 0, total: 1 });
    m.getHargaLaPaket.mockResolvedValue(6_000);
    expect((await getRingkasanAksesUjian(SISWA, MAPEL, "paket-1")).learningAnalytics).toEqual({ harga: 6_000, saldo: 10_000, kuota: { sisa: 0, total: 1 } });
  });

  it("ditanggung sekolah: tanpa harga, dan harga tidak dihitung", async () => {
    m.getActiveEntitlement.mockResolvedValue({ canStartNewAttempt: true, entitlement: { source: "school_seat" } });
    const hasil = await getRingkasanAksesUjian(SISWA, MAPEL, "paket-1");
    expect(hasil.learningAnalytics).toBeNull();
    expect(m.getHargaLaPaket).not.toHaveBeenCalled();
  });
});
