import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  analisisFindUnique: vi.fn(),
  packageFindUnique: vi.fn(),
  attemptCount: vi.fn(),
  attemptUpdate: vi.fn(),
  tryStartProcessing: vi.fn(),
  finishProcessing: vi.fn(),
  prosesSatuAnalisis: vi.fn(),
  tentukanPendanaanAttempt: vi.fn(),
  getSettings: vi.fn(),
  sesudahRespons: [] as Array<() => Promise<void>>,
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => Promise<void>) => {
    m.sesudahRespons.push(fn);
  },
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    aiAnalysis: { findUnique: m.analisisFindUnique },
    package: { findUnique: m.packageFindUnique },
    attempt: { count: m.attemptCount, update: m.attemptUpdate },
  },
}));
vi.mock("@/lib/ai/settings", () => ({ getAiAutoAnalysisSettings: m.getSettings }));
vi.mock("@/lib/ai/analysis-guard", () => ({ tryStartProcessing: m.tryStartProcessing, finishProcessing: m.finishProcessing }));
vi.mock("@/lib/ai/queue-worker", () => ({ prosesSatuAnalisis: m.prosesSatuAnalisis }));
vi.mock("@/lib/billing/pendanaan-la", () => ({ tentukanPendanaanAttempt: m.tentukanPendanaanAttempt }));

import { triggerAutoAnalysis } from "@/lib/ai/auto-trigger";

const attempt = (o: Record<string, unknown> = {}) =>
  ({ id: "att-1", studentId: "siswa-1", packageId: "paket-1", analisisAiDiminta: true, aiAnalysisQueuedAt: null, aiAnalysisProcessingAt: null, ...o }) as never;

beforeEach(() => {
  vi.resetAllMocks();
  m.sesudahRespons.length = 0;
  m.analisisFindUnique.mockResolvedValue(null);
  m.packageFindUnique.mockResolvedValue({ subjectId: "mat", kategori: "mandiri" });
  m.attemptCount.mockResolvedValue(0);
  m.getSettings.mockResolvedValue({ aiAutoAnalysisMaxPerSubject: 3, aiAnalysisMode: "langsung" });
  m.tryStartProcessing.mockResolvedValue(true);
  m.tentukanPendanaanAttempt.mockResolvedValue({ pendanaan: "kuota", kuotaSisa: 1, freeTrial: false });
});

describe("triggerAutoAnalysis - gerbang batas jatah", () => {
  it("tanpa Learning Analytics diminta: tidak diklaim, tidak dijadwalkan, dan tidak menyentuh jatah/sumber dana", async () => {
    await triggerAutoAnalysis(attempt({ analisisAiDiminta: false }));
    expect(m.tryStartProcessing).not.toHaveBeenCalled();
    expect(m.sesudahRespons).toHaveLength(0);
    expect(m.attemptCount).not.toHaveBeenCalled();
    expect(m.tentukanPendanaanAttempt).not.toHaveBeenCalled();
  });

  it("batas belum tercapai: memproses, dan sumber dana TIDAK ditanyakan (tanpa query tambahan di jalur normal)", async () => {
    m.attemptCount.mockResolvedValue(1);
    await triggerAutoAnalysis(attempt());
    expect(m.tentukanPendanaanAttempt).not.toHaveBeenCalled();
    expect(m.tryStartProcessing).toHaveBeenCalledWith("att-1");
    expect(m.sesudahRespons).toHaveLength(1);
  });

  it("batas tercapai + dibiayai jatah gratis: tidak diproses", async () => {
    m.attemptCount.mockResolvedValue(3);
    await triggerAutoAnalysis(attempt());
    expect(m.tentukanPendanaanAttempt).toHaveBeenCalledTimes(1);
    expect(m.tryStartProcessing).not.toHaveBeenCalled();
    expect(m.sesudahRespons).toHaveLength(0);
  });

  it("batas tercapai + dibayar saldo: tetap diproses (yang membayar tidak dibatasi)", async () => {
    m.attemptCount.mockResolvedValue(3);
    m.tentukanPendanaanAttempt.mockResolvedValue({ pendanaan: "saldo", kuotaSisa: null, freeTrial: true });
    await triggerAutoAnalysis(attempt());
    expect(m.tryStartProcessing).toHaveBeenCalledWith("att-1");
    expect(m.sesudahRespons).toHaveLength(1);
    await m.sesudahRespons[0]!();
    expect(m.prosesSatuAnalisis).toHaveBeenCalledWith("att-1");
  });

  it("memberi paket dan percobaan yang benar ke penentu sumber dana", async () => {
    m.attemptCount.mockResolvedValue(3);
    const a = attempt();
    await triggerAutoAnalysis(a);
    expect(m.tentukanPendanaanAttempt).toHaveBeenCalledWith(a, { subjectId: "mat", kategori: "mandiri" });
  });

  it("sudah ada hasil analisis: tidak memproses lagi", async () => {
    m.analisisFindUnique.mockResolvedValue({ attemptId: "att-1" });
    await triggerAutoAnalysis(attempt());
    expect(m.tryStartProcessing).not.toHaveBeenCalled();
  });

  it("gagal memeriksa jatah (mis. database sesaat bermasalah) tidak melempar galat ke pemanggil", async () => {
    m.attemptCount.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(triggerAutoAnalysis(attempt())).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
