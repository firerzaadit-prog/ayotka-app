import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  analisisFindUnique: vi.fn(),
  packageFindUniqueOrThrow: vi.fn(),
  attemptCount: vi.fn(),
  tentukanPendanaanAttempt: vi.fn(),
  getSaldo: vi.fn(),
  getHargaLearningAnalytics: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    aiAnalysis: { findUnique: m.analisisFindUnique },
    package: { findUniqueOrThrow: m.packageFindUniqueOrThrow },
    attempt: { count: m.attemptCount },
  },
}));
vi.mock("@/lib/ai/settings", () => ({ getAiAutoAnalysisSettings: async () => ({ aiAutoAnalysisMaxPerSubject: 3 }) }));
vi.mock("@/lib/billing/pendanaan-la", () => ({ tentukanPendanaanAttempt: m.tentukanPendanaanAttempt }));
vi.mock("@/lib/billing/saldo", () => ({ getSaldo: m.getSaldo, getHargaLearningAnalytics: m.getHargaLearningAnalytics }));

import { hitungOpsiLaSusulan } from "@/lib/billing/la-susulan";

const attempt = (o: Record<string, unknown> = {}) =>
  ({
    id: "att-1",
    studentId: "siswa-1",
    packageId: "paket-1",
    status: "selesai",
    mulaiAt: new Date("2026-10-01T00:00:00Z"),
    aiAnalysisQueuedAt: null,
    aiAnalysisProcessingAt: null,
    ...o,
  }) as never;

beforeEach(() => {
  vi.resetAllMocks();
  m.analisisFindUnique.mockResolvedValue(null);
  m.packageFindUniqueOrThrow.mockResolvedValue({ subjectId: "mat", kategori: "mandiri" });
  m.attemptCount.mockResolvedValue(0);
  m.tentukanPendanaanAttempt.mockResolvedValue({ pendanaan: "saldo", kuotaSisa: null, freeTrial: true });
  m.getSaldo.mockResolvedValue(20000);
  m.getHargaLearningAnalytics.mockResolvedValue(9000);
});

describe("hitungOpsiLaSusulan - kapan tidak tersedia", () => {
  it.each(["berjalan", "paused"])("percobaan berstatus %s: belum selesai, tidak ada query lain", async (status) => {
    expect(await hitungOpsiLaSusulan(attempt({ status }))).toEqual({ tersedia: false, alasan: "belum_selesai" });
    expect(m.analisisFindUnique).not.toHaveBeenCalled();
  });

  it("analisis sudah ada", async () => {
    m.analisisFindUnique.mockResolvedValue({ attemptId: "att-1" });
    expect(await hitungOpsiLaSusulan(attempt())).toEqual({ tersedia: false, alasan: "sudah_ada" });
  });

  it("sedang antre", async () => {
    expect(await hitungOpsiLaSusulan(attempt({ aiAnalysisQueuedAt: new Date() }))).toEqual({
      tersedia: false,
      alasan: "sedang_diproses",
    });
  });

  it("sedang diproses (baru dimulai)", async () => {
    expect(await hitungOpsiLaSusulan(attempt({ aiAnalysisProcessingAt: new Date() }))).toEqual({
      tersedia: false,
      alasan: "sedang_diproses",
    });
  });

  it("penanda 'sedang diproses' yang basi (> 5 menit, mis. server mati di tengah jalan) tidak menghalangi", async () => {
    const basi = new Date(Date.now() - 6 * 60_000);
    const hasil = await hitungOpsiLaSusulan(attempt({ aiAnalysisProcessingAt: basi }));
    expect(hasil.tersedia).toBe(true);
  });

  it("Try Out Nasional: sudah termasuk Learning Analytics otomatis, tidak ada yang dijual susulan", async () => {
    m.packageFindUniqueOrThrow.mockResolvedValue({ subjectId: "mat", kategori: "nasional" });
    expect(await hitungOpsiLaSusulan(attempt())).toEqual({ tersedia: false, alasan: "nasional" });
    expect(m.tentukanPendanaanAttempt).not.toHaveBeenCalled();
  });

  it("percobaan kedaluwarsa (waktu habis) diperlakukan sama seperti selesai", async () => {
    expect((await hitungOpsiLaSusulan(attempt({ status: "kedaluwarsa" }))).tersedia).toBe(true);
  });
});

describe("hitungOpsiLaSusulan - dibayar saldo", () => {
  it("saldo lebih dari harga: cukup, kurang 0", async () => {
    expect(await hitungOpsiLaSusulan(attempt())).toEqual({
      tersedia: true,
      pendanaan: "saldo",
      harga: 9000,
      saldo: 20000,
      cukup: true,
      kurang: 0,
    });
  });

  it("saldo persis sama dengan harga: cukup", async () => {
    m.getSaldo.mockResolvedValue(9000);
    const hasil = await hitungOpsiLaSusulan(attempt());
    expect(hasil).toMatchObject({ pendanaan: "saldo", cukup: true, kurang: 0 });
  });

  it("saldo kurang: tidak cukup dengan selisih yang tepat", async () => {
    m.getSaldo.mockResolvedValue(4000);
    expect(await hitungOpsiLaSusulan(attempt())).toMatchObject({ pendanaan: "saldo", cukup: false, kurang: 5000, saldo: 4000, harga: 9000 });
  });

  it("saldo nol", async () => {
    m.getSaldo.mockResolvedValue(0);
    expect(await hitungOpsiLaSusulan(attempt())).toMatchObject({ cukup: false, kurang: 9000 });
  });

  it("pendanaan saldo tidak menghitung batas jatah (tidak ada query hitung yang sia-sia)", async () => {
    await hitungOpsiLaSusulan(attempt());
    expect(m.attemptCount).not.toHaveBeenCalled();
  });
});

describe("hitungOpsiLaSusulan - dibiayai jatah paket", () => {
  beforeEach(() => {
    m.tentukanPendanaanAttempt.mockResolvedValue({ pendanaan: "kuota", kuotaSisa: 1, freeTrial: false });
  });

  it("jatah ada dan batas belum tercapai", async () => {
    m.attemptCount.mockResolvedValue(2);
    expect(await hitungOpsiLaSusulan(attempt())).toEqual({
      tersedia: true,
      pendanaan: "kuota",
      kuotaSisa: 1,
      batasTercapai: false,
      batasMaks: 3,
    });
    expect(m.getSaldo).not.toHaveBeenCalled();
  });

  it("batas tercapai tepat di angka maksimum", async () => {
    m.attemptCount.mockResolvedValue(3);
    expect(await hitungOpsiLaSusulan(attempt())).toMatchObject({ pendanaan: "kuota", batasTercapai: true, batasMaks: 3 });
  });

  it("menghitung analisis sebelumnya untuk siswa dan mapel yang benar", async () => {
    await hitungOpsiLaSusulan(attempt());
    expect(m.attemptCount).toHaveBeenCalledWith({
      where: { studentId: "siswa-1", aiAutoAnalysisAt: { not: null }, package: { subjectId: "mat" } },
    });
  });
});
