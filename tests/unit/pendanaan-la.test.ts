import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  wasAttemptFreeTrial: vi.fn(),
  getAiKuotaRemaining: vi.fn(),
}));
vi.mock("@/lib/billing/entitlements", () => ({ wasAttemptFreeTrial: m.wasAttemptFreeTrial }));
vi.mock("@/lib/billing/plan-fitur", () => ({ getAiKuotaRemaining: m.getAiKuotaRemaining }));

import { tentukanPendanaanLA } from "@/lib/billing/learning-analytics";
import { tentukanPendanaanAttempt } from "@/lib/billing/pendanaan-la";

describe("tentukanPendanaanLA (aturan murni)", () => {
  it("Try Out Nasional selalu dibundel (kuota), apa pun kondisi lainnya", () => {
    expect(tentukanPendanaanLA({ kategori: "nasional", freeTrial: true, kuotaSisa: null })).toBe("kuota");
    expect(tentukanPendanaanLA({ kategori: "nasional", freeTrial: false, kuotaSisa: 0 })).toBe("kuota");
  });

  it("mandiri dengan jatah tersisa memakai jatah", () => {
    expect(tentukanPendanaanLA({ kategori: "mandiri", freeTrial: false, kuotaSisa: 1 })).toBe("kuota");
    expect(tentukanPendanaanLA({ kategori: "mandiri", freeTrial: false, kuotaSisa: 5 })).toBe("kuota");
  });

  it("mandiri dengan jatah habis memakai saldo", () => {
    expect(tentukanPendanaanLA({ kategori: "mandiri", freeTrial: false, kuotaSisa: 0 })).toBe("saldo");
  });

  it("mandiri tanpa paket aktif (kuotaSisa null) memakai saldo", () => {
    expect(tentukanPendanaanLA({ kategori: "mandiri", freeTrial: false, kuotaSisa: null })).toBe("saldo");
  });

  it("percobaan gratis tidak pernah memakai jatah paket, walau jatah (basi) terkirim positif", () => {
    expect(tentukanPendanaanLA({ kategori: "mandiri", freeTrial: true, kuotaSisa: 3 })).toBe("saldo");
  });
});

describe("tentukanPendanaanAttempt (dengan data)", () => {
  const attempt = { studentId: "siswa-1", mulaiAt: new Date("2026-10-01T00:00:00Z") };

  beforeEach(() => {
    vi.resetAllMocks();
    m.wasAttemptFreeTrial.mockResolvedValue(false);
    m.getAiKuotaRemaining.mockResolvedValue(null);
  });

  it("Try Out Nasional: kuota tanpa memeriksa entitlement atau jatah sama sekali", async () => {
    const hasil = await tentukanPendanaanAttempt(attempt, { subjectId: "mat", kategori: "nasional" });
    expect(hasil).toEqual({ pendanaan: "kuota", kuotaSisa: null, freeTrial: false });
    expect(m.wasAttemptFreeTrial).not.toHaveBeenCalled();
    expect(m.getAiKuotaRemaining).not.toHaveBeenCalled();
  });

  it("percobaan gratis: saldo, dan jatah paket tidak pernah ditanyakan", async () => {
    m.wasAttemptFreeTrial.mockResolvedValue(true);
    m.getAiKuotaRemaining.mockResolvedValue({ sisa: 1, total: 1 });
    const hasil = await tentukanPendanaanAttempt(attempt, { subjectId: "mat", kategori: "mandiri" });
    expect(hasil).toEqual({ pendanaan: "saldo", kuotaSisa: null, freeTrial: true });
    expect(m.getAiKuotaRemaining).not.toHaveBeenCalled();
  });

  it("berlangganan dengan jatah tersisa: kuota, membawa sisa jatahnya", async () => {
    m.getAiKuotaRemaining.mockResolvedValue({ sisa: 2, total: 3 });
    const hasil = await tentukanPendanaanAttempt(attempt, { subjectId: "mat", kategori: "mandiri" });
    expect(hasil).toEqual({ pendanaan: "kuota", kuotaSisa: 2, freeTrial: false });
    expect(m.getAiKuotaRemaining).toHaveBeenCalledWith("siswa-1", "mat");
  });

  it("berlangganan dengan jatah habis: saldo", async () => {
    m.getAiKuotaRemaining.mockResolvedValue({ sisa: 0, total: 3 });
    const hasil = await tentukanPendanaanAttempt(attempt, { subjectId: "mat", kategori: "mandiri" });
    expect(hasil.pendanaan).toBe("saldo");
    expect(hasil.kuotaSisa).toBe(0);
  });

  it("memakai waktu mulai percobaan untuk menentukan percobaan gratis, bukan waktu sekarang", async () => {
    await tentukanPendanaanAttempt(attempt, { subjectId: "mat", kategori: "mandiri" });
    expect(m.wasAttemptFreeTrial).toHaveBeenCalledWith("siswa-1", attempt.mulaiAt);
  });
});
