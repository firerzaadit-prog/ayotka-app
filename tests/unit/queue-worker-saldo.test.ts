import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  attemptFindUnique: vi.fn(),
  attemptCount: vi.fn(),
  attemptUpdate: vi.fn(),
  packageFindUnique: vi.fn(),
  runAnalisisAi: vi.fn(),
  getAiKuotaRemaining: vi.fn(),
  debitSaldoUntukAnalisis: vi.fn(),
  kembalikanSaldoAnalisis: vi.fn(),
  getHargaLearningAnalytics: vi.fn(),
  wasAttemptFreeTrial: vi.fn(),
  finishProcessing: vi.fn(),
  setLastError: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    attempt: { findUnique: m.attemptFindUnique, count: m.attemptCount, update: m.attemptUpdate, findMany: vi.fn() },
    package: { findUnique: m.packageFindUnique },
  },
}));
vi.mock("@/lib/ai/analyze", () => ({ runAnalisisAi: m.runAnalisisAi }));
vi.mock("@/lib/ai/analysis-guard", () => ({
  tryStartProcessing: vi.fn(),
  finishProcessing: m.finishProcessing,
  setLastError: m.setLastError,
  STALE_MS: 1000,
}));
vi.mock("@/lib/ai/settings", () => ({ getAiAutoAnalysisSettings: async () => ({ aiAutoAnalysisMaxPerSubject: 3 }) }));
vi.mock("@/lib/billing/plan-fitur", () => ({ getAiKuotaRemaining: m.getAiKuotaRemaining }));
vi.mock("@/lib/billing/saldo", () => ({
  debitSaldoUntukAnalisis: m.debitSaldoUntukAnalisis,
  kembalikanSaldoAnalisis: m.kembalikanSaldoAnalisis,
  getHargaLearningAnalytics: m.getHargaLearningAnalytics,
}));
vi.mock("@/lib/billing/entitlements", () => ({ wasAttemptFreeTrial: m.wasAttemptFreeTrial }));
vi.mock("@/lib/utils/rate-limited-dispatch", () => ({ runWithRateLimit: vi.fn() }));

import { prosesSatuAnalisis } from "@/lib/ai/queue-worker";

const ATTEMPT = { id: "att-1", studentId: "siswa-1", packageId: "paket-1", mulaiAt: new Date("2026-10-01T00:00:00Z") };

beforeEach(() => {
  vi.clearAllMocks();
  m.attemptFindUnique.mockResolvedValue(ATTEMPT);
  m.attemptCount.mockResolvedValue(0);
  m.packageFindUnique.mockResolvedValue({ subjectId: "mat", kategori: "mandiri", subject: { nama: "Matematika" } });
  m.getHargaLearningAnalytics.mockResolvedValue(9000);
  m.debitSaldoUntukAnalisis.mockResolvedValue(true);
  m.kembalikanSaldoAnalisis.mockResolvedValue(undefined);
  m.runAnalisisAi.mockResolvedValue({});
  m.getAiKuotaRemaining.mockResolvedValue(null);
  m.wasAttemptFreeTrial.mockResolvedValue(false);
});

describe("prosesSatuAnalisis - pendanaan Learning Analytics", () => {
  it("percobaan gratis: tidak pernah memakai jatah paket, selalu dibayar saldo", async () => {
    m.wasAttemptFreeTrial.mockResolvedValue(true);
    // Andai entitlement basi mengembalikan jatah, percobaan gratis tetap tidak boleh memakainya.
    m.getAiKuotaRemaining.mockResolvedValue({ sisa: 1, total: 1 });

    const hasil = await prosesSatuAnalisis("att-1");

    expect(hasil).toBe("selesai");
    expect(m.getAiKuotaRemaining).not.toHaveBeenCalled();
    expect(m.debitSaldoUntukAnalisis).toHaveBeenCalledWith(expect.objectContaining({ harga: 9000, studentId: "siswa-1" }));
    expect(m.runAnalisisAi).toHaveBeenCalledWith(ATTEMPT, "saldo");
    expect(m.kembalikanSaldoAnalisis).not.toHaveBeenCalled();
  });

  it("analisis gagal setelah saldo dipotong -> saldo dikembalikan penuh", async () => {
    m.wasAttemptFreeTrial.mockResolvedValue(true);
    m.runAnalisisAi.mockRejectedValue(new Error("Gemini 503"));

    const hasil = await prosesSatuAnalisis("att-1");

    expect(hasil).toBe("gagal");
    expect(m.kembalikanSaldoAnalisis).toHaveBeenCalledTimes(1);
    expect(m.kembalikanSaldoAnalisis).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: "siswa-1", attemptId: "att-1", harga: 9000 }),
    );
    expect(m.setLastError).toHaveBeenCalled();
  });

  it("saldo tidak cukup saat diproses -> dilewati, tidak ada panggilan AI dan tidak ada pengembalian", async () => {
    m.wasAttemptFreeTrial.mockResolvedValue(true);
    m.debitSaldoUntukAnalisis.mockResolvedValue(false);

    const hasil = await prosesSatuAnalisis("att-1");

    expect(hasil).toBe("dilewati");
    expect(m.runAnalisisAi).not.toHaveBeenCalled();
    expect(m.kembalikanSaldoAnalisis).not.toHaveBeenCalled();
  });

  it("langganan dengan jatah tersisa -> pakai jatah, saldo tidak disentuh", async () => {
    m.getAiKuotaRemaining.mockResolvedValue({ sisa: 1, total: 1 });

    const hasil = await prosesSatuAnalisis("att-1");

    expect(hasil).toBe("selesai");
    expect(m.debitSaldoUntukAnalisis).not.toHaveBeenCalled();
    expect(m.runAnalisisAi).toHaveBeenCalledWith(ATTEMPT, "kuota");
  });

  it("analisis gagal tapi pendanaan dari jatah (tanpa debit) -> tidak ada pengembalian saldo", async () => {
    m.getAiKuotaRemaining.mockResolvedValue({ sisa: 1, total: 1 });
    m.runAnalisisAi.mockRejectedValue(new Error("Gemini 503"));

    const hasil = await prosesSatuAnalisis("att-1");

    expect(hasil).toBe("gagal");
    expect(m.kembalikanSaldoAnalisis).not.toHaveBeenCalled();
  });

  it("pengembalian saldo yang sendirinya gagal tidak menutupi hasil 'gagal' analisis", async () => {
    m.wasAttemptFreeTrial.mockResolvedValue(true);
    m.runAnalisisAi.mockRejectedValue(new Error("Gemini 503"));
    m.kembalikanSaldoAnalisis.mockRejectedValue(new Error("db down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const hasil = await prosesSatuAnalisis("att-1");

    expect(hasil).toBe("gagal");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
