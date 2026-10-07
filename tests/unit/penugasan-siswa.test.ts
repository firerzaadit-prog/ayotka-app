import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  studentFindFirst: vi.fn(),
  assignmentFindFirst: vi.fn(),
  assignmentFindMany: vi.fn(),
  getActiveAssignmentsFor: vi.fn(),
  getSelfSelectPackagesFor: vi.fn(),
  canStartAttempt: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    student: { findFirst: m.studentFindFirst },
    assignment: { findFirst: m.assignmentFindFirst, findMany: m.assignmentFindMany },
    attempt: { findFirst: vi.fn().mockRejectedValue(new Error("gerbang-lolos")) },
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn(), getClientIp: () => "127.0.0.1" }));
vi.mock("@/lib/exam/seri-mandiri", () => ({ statusSeriMandiri: vi.fn() }));
vi.mock("@/lib/exam/attempt-access", () => ({ sanitizeAttemptForClient: (a: unknown) => a }));
vi.mock("@/lib/exam/timing", () => ({ isExpired: vi.fn() }));
vi.mock("@/lib/exam/finalize", () => ({ finalizeAttempt: vi.fn() }));
vi.mock("@/lib/billing/entitlements", () => ({ canStartAttempt: m.canStartAttempt, getActiveEntitlement: vi.fn() }));
vi.mock("@/lib/billing/plan-fitur", () => ({ getAiKuotaRemaining: vi.fn(), getTryOutNasionalKuotaRemaining: vi.fn() }));
vi.mock("@/lib/billing/saldo", () => ({ getSaldo: vi.fn(), getHargaLearningAnalytics: vi.fn() }));
vi.mock("@/lib/billing/learning-analytics", () => ({ putuskanLearningAnalytics: vi.fn() }));
vi.mock("@/lib/exam/percobaan", () => ({ nomorPercobaanById: vi.fn() }));
// Hanya getActiveAssignmentsFor/getSelfSelectPackagesFor yang dipalsukan; getUpcomingAssignmentsFor diuji dengan prisma palsu di bawah.
vi.mock("@/lib/exam/visibility", async (impor) => {
  const asli = await impor<typeof import("@/lib/exam/visibility")>();
  return { ...asli, getActiveAssignmentsFor: m.getActiveAssignmentsFor, getSelfSelectPackagesFor: m.getSelfSelectPackagesFor };
});

import { POST } from "@/app/api/siswa/attempts/route";
import { getUpcomingAssignmentsFor } from "@/lib/exam/visibility";

const ID = "9b1f0c52-9f0c-4c27-9d57-2f7f0d3f6a11";
const SEKARANG = new Date("2026-10-08T00:00:00.000Z");
const SISWA_A = { id: "siswa-1", jalur: "A", schoolId: "sekolah-1", jenjang: "SMP" };

const mulai = (assignmentId: string) =>
  POST(
    new Request("http://localhost/api/siswa/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId }),
    }),
  );

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SEKARANG);
  m.requireRole.mockResolvedValue({ id: "user-1", role: "siswa" });
  m.studentFindFirst.mockResolvedValue(SISWA_A);
  m.getActiveAssignmentsFor.mockResolvedValue([]);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/siswa/attempts - penugasan yang belum aktif untuk siswa", () => {
  it("jendela belum dibuka -> 403 BELUM_DIBUKA dengan waktu buka dalam WIB (bukan 404 yang membingungkan)", async () => {
    m.assignmentFindFirst.mockResolvedValue({ mulai: new Date("2026-10-09T01:00:00Z"), selesai: new Date("2026-10-09T03:00:00Z") });
    const res = await mulai(ID);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("BELUM_DIBUKA");
    expect(json.error).toBe("Ujian ini baru dibuka Jumat, 9 Oktober 2026 pukul 08.00 WIB.");
  });

  it("jendela sudah ditutup -> 403 TELAH_BERAKHIR", async () => {
    m.assignmentFindFirst.mockResolvedValue({ mulai: new Date("2026-10-06T01:00:00Z"), selesai: new Date("2026-10-07T03:00:00Z") });
    const res = await mulai(ID);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("TELAH_BERAKHIR");
  });

  it("pencarian dibatasi pada penugasan AKTIF milik sekolah siswa itu sendiri (tidak membuka ujian sekolah lain)", async () => {
    m.assignmentFindFirst.mockResolvedValue(null);
    const res = await mulai(ID);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Ujian tidak ditemukan atau jendela waktunya sudah tutup.");
    expect(m.assignmentFindFirst).toHaveBeenCalledWith({
      where: { id: ID, schoolId: "sekolah-1", isActive: true },
      select: { mulai: true, selesai: true },
    });
  });

  it("siswa mandiri (Jalur B) tidak pernah mencari penugasan: langsung 404", async () => {
    m.studentFindFirst.mockResolvedValue({ id: "siswa-2", jalur: "B", schoolId: null });
    const res = await mulai(ID);
    expect(res.status).toBe(404);
    expect(m.assignmentFindFirst).not.toHaveBeenCalled();
  });

  it("siswa Jalur A tanpa sekolah juga tidak mencari (filter schoolId null bisa mengenai penugasan pusat)", async () => {
    m.studentFindFirst.mockResolvedValue({ id: "siswa-3", jalur: "A", schoolId: null });
    expect((await mulai(ID)).status).toBe(404);
    expect(m.assignmentFindFirst).not.toHaveBeenCalled();
  });
});

describe("getUpcomingAssignmentsFor - jadwal akan datang untuk siswa", () => {
  it("hanya penugasan AKTIF sekolah siswa yang mulainya di masa depan, terdekat dulu", async () => {
    m.assignmentFindMany.mockResolvedValue([{ id: "a1" }]);
    const hasil = await getUpcomingAssignmentsFor(SISWA_A as never, SEKARANG);
    expect(hasil).toEqual([{ id: "a1" }]);
    expect(m.assignmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId: "sekolah-1", isActive: true, mulai: { gt: SEKARANG } },
        orderBy: { mulai: "asc" },
        take: 20,
      }),
    );
  });

  it("siswa Jalur B atau tanpa sekolah -> kosong tanpa kueri", async () => {
    expect(await getUpcomingAssignmentsFor({ ...SISWA_A, jalur: "B", schoolId: null } as never, SEKARANG)).toEqual([]);
    expect(await getUpcomingAssignmentsFor({ ...SISWA_A, schoolId: null } as never, SEKARANG)).toEqual([]);
    expect(m.assignmentFindMany).not.toHaveBeenCalled();
  });
});
