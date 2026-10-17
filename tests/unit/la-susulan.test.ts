import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  analisisFindUnique: vi.fn(),
  packageFindUniqueOrThrow: vi.fn(),
  attemptCount: vi.fn(),
  studentFindUnique: vi.fn(),
  kursiSekolahTersedia: vi.fn(),
  tentukanPendanaanAttempt: vi.fn(),
  getSaldo: vi.fn(),
  getHargaLaPaket: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    aiAnalysis: { findUnique: m.analisisFindUnique },
    package: { findUniqueOrThrow: m.packageFindUniqueOrThrow },
    attempt: { count: m.attemptCount },
    student: { findUnique: m.studentFindUnique },
  },
}));
vi.mock("@/lib/billing/entitlements", () => ({ kursiSekolahTersedia: m.kursiSekolahTersedia }));
vi.mock("@/lib/ai/settings", () => ({ getAiAutoAnalysisSettings: async () => ({ aiAutoAnalysisMaxPerSubject: 3 }) }));
vi.mock("@/lib/billing/pendanaan-la", () => ({ tentukanPendanaanAttempt: m.tentukanPendanaanAttempt }));
vi.mock("@/lib/billing/saldo", () => ({ getSaldo: m.getSaldo, getHargaLaPaket: m.getHargaLaPaket }));

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
  m.getHargaLaPaket.mockResolvedValue(9000);
  m.studentFindUnique.mockResolvedValue({ id: "siswa-1", schoolId: null, jalur: "B", deletedAt: null, lulusAt: null });
  m.kursiSekolahTersedia.mockResolvedValue(false);
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
  it("harga dihitung dari PAKET percobaan itu (banyaknya soal): paket berbeda bisa berharga berbeda", async () => {
    m.getHargaLaPaket.mockImplementation(async (id: string) => (id === "paket-besar" ? 7500 : 4500));
    expect(await hitungOpsiLaSusulan(attempt({ packageId: "paket-kecil" }))).toMatchObject({ harga: 4500 });
    expect(await hitungOpsiLaSusulan(attempt({ packageId: "paket-besar" }))).toMatchObject({ harga: 7500 });
    expect(m.getHargaLaPaket).toHaveBeenCalledWith("paket-kecil");
    expect(m.getHargaLaPaket).toHaveBeenCalledWith("paket-besar");
  });

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

  it("saldo cukup: tidak memeriksa kursi sekolah dan tidak membawa bisaBeliPaket (tanpa query yang sia-sia)", async () => {
    const hasil = await hitungOpsiLaSusulan(attempt());
    expect(hasil).not.toHaveProperty("bisaBeliPaket");
    expect(m.studentFindUnique).not.toHaveBeenCalled();
    expect(m.kursiSekolahTersedia).not.toHaveBeenCalled();
  });

  it("saldo kurang pada siswa mandiri / sekolahnya tidak menanggung: paket pribadi bisa dibeli", async () => {
    m.getSaldo.mockResolvedValue(0);
    expect(await hitungOpsiLaSusulan(attempt())).toMatchObject({ cukup: false, bisaBeliPaket: true });
    expect(m.studentFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "siswa-1" } }));
  });

  it("saldo kurang pada siswa yang sedang ditanggung kursi sekolah: paket pribadi tidak ditawarkan", async () => {
    m.getSaldo.mockResolvedValue(0);
    m.studentFindUnique.mockResolvedValue({ id: "siswa-1", schoolId: "sekolah-1", jalur: "A", deletedAt: null, lulusAt: null });
    m.kursiSekolahTersedia.mockResolvedValue(true);
    expect(await hitungOpsiLaSusulan(attempt())).toMatchObject({ cukup: false, bisaBeliPaket: false });
    expect(m.kursiSekolahTersedia).toHaveBeenCalledWith(expect.objectContaining({ id: "siswa-1", jalur: "A" }));
  });

  it("saldo kurang tetapi data siswa tidak ditemukan: dianggap boleh membeli (jatuh ke perilaku lama)", async () => {
    m.getSaldo.mockResolvedValue(0);
    m.studentFindUnique.mockResolvedValue(null);
    expect(await hitungOpsiLaSusulan(attempt())).toMatchObject({ cukup: false, bisaBeliPaket: true });
    expect(m.kursiSekolahTersedia).not.toHaveBeenCalled();
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
