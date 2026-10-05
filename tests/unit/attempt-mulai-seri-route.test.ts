import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  studentFindFirst: vi.fn(),
  attemptFindFirst: vi.fn(),
  getSelfSelectPackagesFor: vi.fn(),
  getActiveAssignmentsFor: vi.fn(),
  statusSeriMandiri: vi.fn(),
  canStartAttempt: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { student: { findFirst: m.studentFindFirst }, attempt: { findFirst: m.attemptFindFirst } },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn(), getClientIp: () => "127.0.0.1" }));
vi.mock("@/lib/exam/visibility", () => ({
  getSelfSelectPackagesFor: m.getSelfSelectPackagesFor,
  getActiveAssignmentsFor: m.getActiveAssignmentsFor,
}));
vi.mock("@/lib/exam/seri-mandiri", () => ({ statusSeriMandiri: m.statusSeriMandiri }));
vi.mock("@/lib/exam/attempt-access", () => ({ sanitizeAttemptForClient: (a: unknown) => a }));
vi.mock("@/lib/exam/timing", () => ({ isExpired: vi.fn() }));
vi.mock("@/lib/exam/finalize", () => ({ finalizeAttempt: vi.fn() }));
vi.mock("@/lib/billing/entitlements", () => ({ canStartAttempt: m.canStartAttempt, getActiveEntitlement: vi.fn() }));
vi.mock("@/lib/billing/plan-fitur", () => ({ getAiKuotaRemaining: vi.fn(), getTryOutNasionalKuotaRemaining: vi.fn() }));
vi.mock("@/lib/billing/saldo", () => ({ getSaldo: vi.fn(), getHargaLearningAnalytics: vi.fn() }));
vi.mock("@/lib/billing/learning-analytics", () => ({ putuskanLearningAnalytics: vi.fn() }));
vi.mock("@/lib/exam/percobaan", () => ({ nomorPercobaanById: vi.fn() }));

import { POST } from "@/app/api/siswa/attempts/route";

const ID_B = "22222222-2222-4222-8222-222222222222";
const STUDENT = { id: "siswa-1", jalur: "B", schoolId: null };

const paket = (id: string, urutanSeri: number | null, extra: Record<string, unknown> = {}) => ({
  id,
  nama: `Paket ${urutanSeri ?? id}`,
  subjectId: "mat",
  kategori: "mandiri",
  urutanSeri,
  bukaMulai: null,
  bukaSelesai: null,
  ...extra,
});
const PAKET_A = paket("11111111-1111-4111-8111-111111111111", 1);
const PAKET_B = paket(ID_B, 2);
const PAKET_IPA = paket("33333333-3333-4333-8333-333333333333", 1, { subjectId: "ipa" });
const PAKET_NASIONAL = paket("44444444-4444-4444-8444-444444444444", null, { kategori: "nasional" });

const mulai = (packageId: string) =>
  POST(
    new Request("http://localhost/api/siswa/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId }),
    }),
  );

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "user-1", role: "siswa" });
  m.studentFindFirst.mockResolvedValue(STUDENT);
  m.getSelfSelectPackagesFor.mockResolvedValue([PAKET_A, PAKET_B, PAKET_IPA, PAKET_NASIONAL]);
  m.getActiveAssignmentsFor.mockResolvedValue([]);
  m.canStartAttempt.mockResolvedValue({ allowed: true });
  m.statusSeriMandiri.mockResolvedValue({ terkunci: false });
  // Titik berhenti setelah gerbang seri: kalau gerbang meloloskan, rute lanjut ke pencarian percobaan yang ada.
  m.attemptFindFirst.mockRejectedValue(new Error("gerbang-lolos"));
});

describe("POST /api/siswa/attempts - gerbang seri Try Out Mandiri", () => {
  it("paket sebelumnya belum diselesaikan -> 409 PAKET_TERKUNCI dengan penjelasan aturan 06.00 WIB", async () => {
    m.statusSeriMandiri.mockResolvedValue({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket 1" });
    const res = await mulai(ID_B);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("PAKET_TERKUNCI");
    expect(body.error).toBe(
      'Selesaikan dulu "Paket 1" sebelum mengerjakan paket ini. Setelah itu, paket ini terbuka pukul 06.00 WIB berikutnya.',
    );
    expect(m.attemptFindFirst).not.toHaveBeenCalled();
  });

  it("paket sebelumnya hanya dikumpulkan KOSONG -> 409 dengan petunjuk menjawab minimal satu soal", async () => {
    m.statusSeriMandiri.mockResolvedValue({
      terkunci: true,
      alasan: "belum_giliran",
      namaPaketSebelumnya: "Paket 1",
      percobaanKosong: true,
    });
    const res = await mulai(ID_B);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("PAKET_TERKUNCI");
    expect(body.error).toBe(
      'Kamu sudah mengumpulkan "Paket 1", tetapi belum ada soal yang dijawab. Jawab minimal satu soal di "Paket 1" agar paket ini terbuka pukul 06.00 WIB berikutnya.',
    );
    expect(m.attemptFindFirst).not.toHaveBeenCalled();
  });

  it("sudah selesai tapi belum 06.00 -> 409 dengan waktu buka dalam WIB", async () => {
    m.statusSeriMandiri.mockResolvedValue({
      terkunci: true,
      alasan: "menunggu_jadwal",
      namaPaketSebelumnya: "Paket 1",
      bukaPada: new Date("2026-10-06T23:00:00.000Z"), // Rabu 7 Okt 06.00 WIB
    });
    const res = await mulai(ID_B);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("PAKET_TERKUNCI");
    expect(body.error).toBe(
      'Paket ini terbuka Rabu, 7 Oktober 2026 pukul 06.00 WIB. Paket baru dibuka tiap pukul 06.00 WIB setelah paket sebelumnya ("Paket 1") selesai.',
    );
    expect(m.attemptFindFirst).not.toHaveBeenCalled();
  });

  it("paket terbuka -> gerbang meloloskan dan rute lanjut ke langkah berikutnya", async () => {
    await expect(mulai(ID_B)).rejects.toThrow("gerbang-lolos");
    expect(m.attemptFindFirst).toHaveBeenCalledTimes(1);
  });

  it("gerbang dipanggil untuk siswa ini dengan paket-seri yang TERLIHAT di mapel & kategori yang sama saja", async () => {
    await expect(mulai(ID_B)).rejects.toThrow("gerbang-lolos");
    const [studentId, target, kandidat] = m.statusSeriMandiri.mock.calls[0]!;
    expect(studentId).toBe("siswa-1");
    expect(target).toEqual({ id: ID_B, subjectId: "mat", urutanSeri: 2, bukaMulai: null });
    expect((kandidat as { id: string }[]).map((p) => p.id).sort()).toEqual([PAKET_A.id, ID_B].sort()); // tanpa IPA & Nasional
  });

  it("bukaMulai di masa depan ditolak lebih dulu (BELUM_DIBUKA) sebelum gerbang seri", async () => {
    m.getSelfSelectPackagesFor.mockResolvedValue([paket(ID_B, 2, { bukaMulai: new Date(Date.now() + 86_400_000) })]);
    const res = await mulai(ID_B);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("BELUM_DIBUKA");
    expect(m.statusSeriMandiri).not.toHaveBeenCalled();
  });

  it("paket yang tidak ada di daftar siswa -> 404 (tidak bocor, gerbang seri tidak dipanggil)", async () => {
    const res = await mulai("55555555-5555-4555-8555-555555555555");
    expect(res.status).toBe(404);
    expect(m.statusSeriMandiri).not.toHaveBeenCalled();
  });
});
