import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  studentFindFirst: vi.fn(),
  attemptFindFirst: vi.fn(),
  paketLengkap: vi.fn(),
  attemptCreate: vi.fn(),
  jawabanCreateMany: vi.fn(),
  getSelfSelectPackagesFor: vi.fn(),
  getActiveEntitlement: vi.fn(),
  getAiKuotaRemaining: vi.fn(),
  getSaldo: vi.fn(),
  getHargaLaPaket: vi.fn(),
  /** Beban AI paket yang "dibaca dari database" (taksiran token masukan). */
  beban: 0,
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    student: { findFirst: m.studentFindFirst },
    attempt: { findFirst: m.attemptFindFirst },
    package: { findUniqueOrThrow: m.paketLengkap },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ attempt: { create: m.attemptCreate }, attemptAnswer: { createMany: m.jawabanCreateMany } }),
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn(), getClientIp: () => "127.0.0.1" }));
vi.mock("@/lib/exam/visibility", () => ({ getSelfSelectPackagesFor: m.getSelfSelectPackagesFor, getActiveAssignmentsFor: vi.fn() }));
vi.mock("@/lib/exam/seri-mandiri", () => ({ statusSeriMandiri: vi.fn(async () => ({ terkunci: false })) }));
vi.mock("@/lib/exam/attempt-access", () => ({ sanitizeAttemptForClient: (a: unknown) => a }));
vi.mock("@/lib/exam/timing", () => ({ isExpired: vi.fn() }));
vi.mock("@/lib/exam/finalize", () => ({ finalizeAttempt: vi.fn() }));
vi.mock("@/lib/billing/entitlements", () => ({ canStartAttempt: vi.fn(async () => ({ allowed: true })), getActiveEntitlement: m.getActiveEntitlement }));
vi.mock("@/lib/billing/plan-fitur", () => ({ getAiKuotaRemaining: m.getAiKuotaRemaining, getTryOutNasionalKuotaRemaining: vi.fn() }));
vi.mock("@/lib/exam/percobaan", () => ({ nomorPercobaanById: vi.fn() }));
// Harga memakai fungsi hitung SUNGGUHAN (lib/billing/harga-la.ts) dengan pengaturan bawaan; hanya pembacaan database (beban AI paket) yang ditiru.
vi.mock("@/lib/billing/saldo", async () => {
  const { hitungHargaLA } = await import("@/lib/billing/harga-la");
  m.getHargaLaPaket.mockImplementation(async () => hitungHargaLA(m.beban));
  return { getSaldo: m.getSaldo, getHargaLaPaket: m.getHargaLaPaket };
});

import { POST } from "@/app/api/siswa/attempts/route";

const PAKET_ID = "11111111-1111-4111-8111-111111111111";
const PAKET = { id: PAKET_ID, nama: "Paket Uji", subjectId: "mat", kategori: "mandiri", urutanSeri: null, bukaMulai: null, bukaSelesai: null };
const soal = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `q${i}`, bobot: 1 }));
const paketLengkap = (jumlah: number) => ({ ...PAKET, durasiMenit: 60, maxAttempt: null, questions: soal(jumlah) });
/** Mengatur beban AI paket (token masukan taksiran); bawaan: ringan <= 6.500 = Rp4.500, berat >= 13.500 = Rp7.500, di antaranya naik lurus. */
const bebanPaket = (beban: number) => {
  m.beban = beban;
};

const mulai = (gunakanLearningAnalytics: boolean | undefined) =>
  POST(
    new Request("http://localhost/api/siswa/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId: PAKET_ID, ...(gunakanLearningAnalytics === undefined ? {} : { gunakanLearningAnalytics }) }),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  m.requireRole.mockResolvedValue({ id: "user-1", role: "siswa" });
  m.studentFindFirst.mockResolvedValue({ id: "siswa-1", jalur: "B", schoolId: null });
  m.getSelfSelectPackagesFor.mockResolvedValue([PAKET]);
  m.attemptFindFirst.mockResolvedValue(null);
  m.getActiveEntitlement.mockResolvedValue(null); // paket gratis: Learning Analytics hanya lewat saldo
  m.getAiKuotaRemaining.mockResolvedValue(null);
  m.getSaldo.mockResolvedValue(0);
  m.beban = 0;
  m.attemptCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "att-baru", ...data }));
  m.jawabanCreateMany.mockResolvedValue({ count: 0 });
});

describe("POST /api/siswa/attempts - harga Learning Analytics mengikuti beban AI paket", () => {
  it("paket berbeban 9.500 token = Rp6.000: saldo Rp5.000 kurang -> 402 dengan harga paket itu, attempt tidak dibuat", async () => {
    m.paketLengkap.mockResolvedValue(paketLengkap(30));
    bebanPaket(9_500);
    m.getSaldo.mockResolvedValue(5_000);
    const res = await mulai(true);
    expect(res.status).toBe(402);
    const badan = await res.json();
    expect(badan.code).toBe("SALDO_TIDAK_CUKUP");
    expect(badan.error).toMatch(/butuh Rp\s?6\.000/);
    expect(badan.error).toMatch(/saldo kamu Rp\s?5\.000/);
    // harga dihitung dari isi PAKET yang dipilih (bukan dari jumlah soal)
    expect(m.getHargaLaPaket).toHaveBeenCalledWith(PAKET_ID);
    expect(m.attemptCreate).not.toHaveBeenCalled();
  });

  it("paket berbeban 20.000 token = Rp7.500 (maksimum): saldo Rp7.000 kurang", async () => {
    m.paketLengkap.mockResolvedValue(paketLengkap(60));
    bebanPaket(20_000);
    m.getSaldo.mockResolvedValue(7_000);
    const res = await mulai(true);
    expect(res.status).toBe(402);
    expect((await res.json()).error).toMatch(/butuh Rp\s?7\.500/);
  });

  it("paket berbeban 3.000 token = Rp4.500 (minimum): saldo Rp4.500 cukup -> attempt dibuat dengan Learning Analytics diminta", async () => {
    m.paketLengkap.mockResolvedValue(paketLengkap(10));
    bebanPaket(3_000);
    m.getSaldo.mockResolvedValue(4_500);
    const res = await mulai(true);
    expect(res.status).toBe(201);
    expect(m.attemptCreate).toHaveBeenCalledTimes(1);
    expect(m.attemptCreate.mock.calls[0]![0].data).toMatchObject({ studentId: "siswa-1", packageId: PAKET_ID, analisisAiDiminta: true });
  });

  it("saldo persis sama dengan harga paket (Rp6.000 untuk beban 9.500 token): cukup", async () => {
    m.paketLengkap.mockResolvedValue(paketLengkap(30));
    bebanPaket(9_500);
    m.getSaldo.mockResolvedValue(6_000);
    expect((await mulai(true)).status).toBe(201);
  });

  it("tanpa meminta Learning Analytics: tidak ada pemeriksaan harga atau saldo sama sekali", async () => {
    m.paketLengkap.mockResolvedValue(paketLengkap(30));
    const res = await mulai(undefined);
    expect(res.status).toBe(201);
    expect(m.getHargaLaPaket).not.toHaveBeenCalled();
    expect(m.getSaldo).not.toHaveBeenCalled();
    expect(m.attemptCreate.mock.calls[0]![0].data.analisisAiDiminta).toBe(false);
  });
});
