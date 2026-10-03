import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  resolveSchoolId: vi.fn(),
  attemptFindUnique: vi.fn(),
  attemptUpdate: vi.fn(),
  aiFindUnique: vi.fn(),
  dinasFindUnique: vi.fn(),
  buildHasil: vi.fn(),
  logAudit: vi.fn(),
  finalize: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/schools/scope", () => ({ resolveSchoolId: m.resolveSchoolId }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "127.0.0.1" }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    attempt: { findUnique: m.attemptFindUnique, update: m.attemptUpdate },
    aiAnalysis: { findUnique: m.aiFindUnique },
    dinasAdmin: { findUnique: m.dinasFindUnique },
  },
}));
vi.mock("@/lib/exam/timing", () => ({ isExpired: () => false, getRemainingSeconds: () => 100 }));
vi.mock("@/lib/exam/finalize", () => ({ finalizeAttempt: m.finalize }));
vi.mock("@/lib/exam/hasil", () => ({ buildHasil: m.buildHasil }));
vi.mock("@/lib/pdf/rapor-renderer", () => ({ renderRaporPdf: vi.fn(), fetchImageBuffer: vi.fn() }));
vi.mock("@/lib/ai/analyze", () => ({ runAnalisisAi: vi.fn() }));
vi.mock("@/lib/ai/analysis-guard", () => ({
  isProcessing: () => false,
  tryStartProcessing: vi.fn(),
  finishProcessing: vi.fn(),
  setLastError: vi.fn(),
}));
vi.mock("@/lib/billing/entitlements", () => ({ wasAttemptFreeTrial: vi.fn().mockResolvedValue(false) }));

import { POST as pausePOST } from "@/app/api/admin-sekolah/attempts/[id]/pause/route";
import { POST as resumePOST } from "@/app/api/admin-sekolah/attempts/[id]/resume/route";
import { GET as raporGET } from "@/app/api/siswa/attempts/[id]/rapor/route";
import { GET as analisisGET } from "@/app/api/attempts/[id]/analisis-ai/route";

const SEKOLAH = "sek-1";
const MALANG = "Kota Malang";
const ctx = { params: Promise.resolve({ id: "att-1" }) };
const req = () => new Request("http://localhost/x", { method: "POST" });

type OverrideSiswa = Partial<{ jalur: string; schoolId: string | null; deletedAt: Date | null; kabupatenKota: string | null }>;
function attemptDengan(status: string, siswa: OverrideSiswa = {}) {
  const { kabupatenKota = MALANG, ...lain } = siswa;
  return {
    id: "att-1",
    status,
    studentId: "s-1",
    mulaiAt: new Date(),
    sisaDetik: 600,
    aiAnalysisProcessingAt: null,
    aiAnalysisQueuedAt: null,
    aiAnalysisLastError: null,
    student: { id: "s-1", jalur: "A", schoolId: SEKOLAH, deletedAt: null, school: { kabupatenKota }, ...lain },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "admin-1", role: "admin_sekolah" });
  m.resolveSchoolId.mockResolvedValue(SEKOLAH);
  m.logAudit.mockResolvedValue(undefined);
  m.attemptUpdate.mockImplementation(async ({ data }: { data: object }) => ({ id: "att-1", ...data }));
  m.buildHasil.mockResolvedValue({ bisaUnduhRapor: false });
  m.aiFindUnique.mockResolvedValue(null);
});

describe("jeda dan lanjutkan ujian oleh admin sekolah: hanya siswa Jalur A milik sekolah yang belum dihapus", () => {
  it.each([
    ["siswa mandiri (Jalur B) yang mencatat sekolah ini sebagai asal", { jalur: "B" }],
    ["siswa yang sudah dihapus/diarsipkan", { deletedAt: new Date() }],
    ["siswa sekolah lain", { schoolId: "sek-lain" }],
  ] as const)("pause: %s -> 404 dan tidak ada yang diubah", async (_nama, siswa) => {
    m.attemptFindUnique.mockResolvedValue(attemptDengan("berjalan", siswa));
    expect((await pausePOST(req(), ctx)).status).toBe(404);
    expect(m.attemptUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["siswa mandiri (Jalur B) yang mencatat sekolah ini sebagai asal", { jalur: "B" }],
    ["siswa yang sudah dihapus/diarsipkan", { deletedAt: new Date() }],
    ["siswa sekolah lain", { schoolId: "sek-lain" }],
  ] as const)("resume: %s -> 404 dan tidak ada yang diubah", async (_nama, siswa) => {
    m.attemptFindUnique.mockResolvedValue(attemptDengan("paused", siswa));
    expect((await resumePOST(req(), ctx)).status).toBe(404);
    expect(m.attemptUpdate).not.toHaveBeenCalled();
  });

  it("siswa Jalur A sekolahnya sendiri: pause dan resume tetap berjalan seperti biasa", async () => {
    m.attemptFindUnique.mockResolvedValue(attemptDengan("berjalan"));
    expect((await pausePOST(req(), ctx)).status).toBe(200);
    m.attemptFindUnique.mockResolvedValue(attemptDengan("paused"));
    expect((await resumePOST(req(), ctx)).status).toBe(200);
    expect(m.attemptUpdate).toHaveBeenCalledTimes(2);
  });

  it("alumni (sudah lulus, belum dihapus) tetap bisa dijeda/dilanjutkan bila masih ada attempt berjalan", async () => {
    m.attemptFindUnique.mockResolvedValue(attemptDengan("berjalan", { lulusAt: new Date() } as never));
    expect((await pausePOST(req(), ctx)).status).toBe(200);
  });
});

describe("rapor PDF: admin sekolah tidak bisa mengambil rapor siswa mandiri atau siswa arsip lewat ID attempt", () => {
  it("admin sekolah + siswa Jalur B: 404", async () => {
    m.attemptFindUnique.mockResolvedValue(attemptDengan("selesai", { jalur: "B" }));
    expect((await raporGET(req(), ctx)).status).toBe(404);
    expect(m.buildHasil).not.toHaveBeenCalled();
  });

  it("admin sekolah + siswa yang sudah dihapus: 404", async () => {
    m.attemptFindUnique.mockResolvedValue(attemptDengan("selesai", { deletedAt: new Date() }));
    expect((await raporGET(req(), ctx)).status).toBe(404);
  });

  it("admin sekolah + siswa sekolah lain: 404", async () => {
    m.attemptFindUnique.mockResolvedValue(attemptDengan("selesai", { schoolId: "sek-lain" }));
    expect((await raporGET(req(), ctx)).status).toBe(404);
  });

  it("admin sekolah + siswa Jalur A miliknya: lolos pemeriksaan akses (sampai ke aturan rapor, 409 dari stub)", async () => {
    m.attemptFindUnique.mockResolvedValue(attemptDengan("selesai"));
    expect((await raporGET(req(), ctx)).status).toBe(409);
    expect(m.buildHasil).toHaveBeenCalledTimes(1);
  });

  it("admin pusat tetap boleh untuk siapa pun, termasuk siswa mandiri dan arsip (perilaku lama)", async () => {
    m.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
    m.attemptFindUnique.mockResolvedValue(attemptDengan("selesai", { jalur: "B", deletedAt: new Date() }));
    expect((await raporGET(req(), ctx)).status).toBe(409);
    expect(m.buildHasil).toHaveBeenCalledTimes(1);
  });
});

describe("status analisis AI (GET): cakupan per peran", () => {
  const baca = () => analisisGET(req(), ctx);
  const selesai = (siswa: OverrideSiswa = {}) => attemptDengan("selesai", siswa);

  beforeEach(() => {
    m.aiFindUnique.mockResolvedValue({ detailJson: { ringkasan: "ok" }, generatedAt: new Date(), versiPrompt: "x" });
  });

  it("dinas: siswa Jalur A di wilayahnya -> 200", async () => {
    m.requireRole.mockResolvedValue({ id: "dinas-1", role: "dinas_pendidikan" });
    m.dinasFindUnique.mockResolvedValue({ kabupatenKota: MALANG });
    m.attemptFindUnique.mockResolvedValue(selesai());
    expect((await baca()).status).toBe(200);
  });

  it.each([
    ["siswa di wilayah lain", { kabupatenKota: "Kota Surabaya" }],
    ["siswa mandiri walau sekolah asalnya di wilayahnya", { jalur: "B" }],
    ["siswa yang sudah dihapus", { deletedAt: new Date() }],
    ["siswa tanpa sekolah", { schoolId: null, kabupatenKota: null }],
  ] as const)("dinas: %s -> 404", async (_nama, siswa) => {
    m.requireRole.mockResolvedValue({ id: "dinas-1", role: "dinas_pendidikan" });
    m.dinasFindUnique.mockResolvedValue({ kabupatenKota: MALANG });
    m.attemptFindUnique.mockResolvedValue(selesai(siswa));
    expect((await baca()).status).toBe(404);
  });

  it("dinas tanpa profil wilayah: 404 untuk semua attempt (gagal tertutup)", async () => {
    m.requireRole.mockResolvedValue({ id: "dinas-1", role: "dinas_pendidikan" });
    m.dinasFindUnique.mockResolvedValue(null);
    m.attemptFindUnique.mockResolvedValue(selesai());
    expect((await baca()).status).toBe(404);
  });

  it("admin sekolah: siswa Jalur A miliknya 200; siswa mandiri, arsip, dan sekolah lain 404", async () => {
    m.attemptFindUnique.mockResolvedValue(selesai());
    expect((await baca()).status).toBe(200);
    for (const siswa of [{ jalur: "B" }, { deletedAt: new Date() }, { schoolId: "sek-lain" }] as OverrideSiswa[]) {
      m.attemptFindUnique.mockResolvedValue(selesai(siswa));
      expect((await baca()).status).toBe(404);
    }
  });

  it("admin pusat: tetap 200 untuk siapa pun", async () => {
    m.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
    m.attemptFindUnique.mockResolvedValue(selesai({ jalur: "B", deletedAt: new Date() }));
    expect((await baca()).status).toBe(200);
  });
});
