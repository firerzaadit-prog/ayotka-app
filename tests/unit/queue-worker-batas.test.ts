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
  vi.resetAllMocks();
  m.attemptFindUnique.mockResolvedValue(ATTEMPT);
  m.attemptCount.mockResolvedValue(0);
  m.attemptUpdate.mockResolvedValue({});
  m.packageFindUnique.mockResolvedValue({ subjectId: "mat", kategori: "mandiri", subject: { nama: "Matematika" } });
  m.getHargaLearningAnalytics.mockResolvedValue(9000);
  m.debitSaldoUntukAnalisis.mockResolvedValue(true);
  m.kembalikanSaldoAnalisis.mockResolvedValue(undefined);
  m.runAnalisisAi.mockResolvedValue({});
  m.getAiKuotaRemaining.mockResolvedValue(null);
  m.wasAttemptFreeTrial.mockResolvedValue(false);
});

describe("prosesSatuAnalisis - batas 'maksimal N analisis otomatis per siswa per mapel'", () => {
  it("yang membayar saldo TIDAK dibatasi: batas sudah tercapai, analisis tetap jalan dan saldo didebit", async () => {
    m.wasAttemptFreeTrial.mockResolvedValue(true); // percobaan gratis -> dibayar saldo
    m.attemptCount.mockResolvedValue(3); // batas (3) sudah tercapai

    const hasil = await prosesSatuAnalisis("att-1");

    expect(hasil).toBe("selesai");
    expect(m.debitSaldoUntukAnalisis).toHaveBeenCalledTimes(1);
    expect(m.runAnalisisAi).toHaveBeenCalledWith(ATTEMPT, "saldo");
  });

  it("yang dibiayai jatah gratis tetap dibatasi: batas tercapai -> dilewati tanpa debit dan tanpa AI", async () => {
    m.getAiKuotaRemaining.mockResolvedValue({ sisa: 1, total: 1 });
    m.attemptCount.mockResolvedValue(3);

    const hasil = await prosesSatuAnalisis("att-1");

    expect(hasil).toBe("dilewati");
    expect(m.debitSaldoUntukAnalisis).not.toHaveBeenCalled();
    expect(m.runAnalisisAi).not.toHaveBeenCalled();
  });

  it("Try Out Nasional (dibundel) tetap dibatasi seperti sebelumnya", async () => {
    m.packageFindUnique.mockResolvedValue({ subjectId: "mat", kategori: "nasional", subject: { nama: "Matematika" } });
    m.attemptCount.mockResolvedValue(3);

    const hasil = await prosesSatuAnalisis("att-1");

    expect(hasil).toBe("dilewati");
    expect(m.runAnalisisAi).not.toHaveBeenCalled();
  });

  it("jatah gratis belum mencapai batas -> jalan memakai jatah", async () => {
    m.getAiKuotaRemaining.mockResolvedValue({ sisa: 1, total: 1 });
    m.attemptCount.mockResolvedValue(2);

    const hasil = await prosesSatuAnalisis("att-1");

    expect(hasil).toBe("selesai");
    expect(m.runAnalisisAi).toHaveBeenCalledWith(ATTEMPT, "kuota");
    expect(m.debitSaldoUntukAnalisis).not.toHaveBeenCalled();
  });

  it("pendanaan saldo tidak menghitung jumlah analisis sebelumnya sama sekali (tanpa query yang sia-sia)", async () => {
    m.wasAttemptFreeTrial.mockResolvedValue(true);
    await prosesSatuAnalisis("att-1");
    expect(m.attemptCount).not.toHaveBeenCalled();
  });

  it("saldo tidak cukup saat diproses tetap dilewati tanpa AI, walau batas belum tercapai", async () => {
    m.wasAttemptFreeTrial.mockResolvedValue(true);
    m.debitSaldoUntukAnalisis.mockResolvedValue(false);

    const hasil = await prosesSatuAnalisis("att-1");

    expect(hasil).toBe("dilewati");
    expect(m.runAnalisisAi).not.toHaveBeenCalled();
    expect(m.kembalikanSaldoAnalisis).not.toHaveBeenCalled();
  });

  it("analisis berbayar yang gagal mengembalikan saldo walau batas sudah tercapai", async () => {
    m.wasAttemptFreeTrial.mockResolvedValue(true);
    m.attemptCount.mockResolvedValue(9);
    m.runAnalisisAi.mockRejectedValue(new Error("Gemini 503"));

    const hasil = await prosesSatuAnalisis("att-1");

    expect(hasil).toBe("gagal");
    expect(m.kembalikanSaldoAnalisis).toHaveBeenCalledWith(expect.objectContaining({ harga: 9000, attemptId: "att-1" }));
  });
});
