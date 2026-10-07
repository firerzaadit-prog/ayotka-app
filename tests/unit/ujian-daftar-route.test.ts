import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  studentFindFirst: vi.fn(),
  attemptFindMany: vi.fn(),
  planFindUnique: vi.fn(),
  getActiveAssignmentsFor: vi.fn(),
  getUpcomingAssignmentsFor: vi.fn(),
  getSelfSelectPackagesFor: vi.fn(),
  annotateSeriMandiri: vi.fn(),
  getActiveEntitlement: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    student: { findFirst: m.studentFindFirst },
    attempt: { findMany: m.attemptFindMany },
    plan: { findUnique: m.planFindUnique },
  },
}));
vi.mock("@/lib/exam/visibility", () => ({
  getActiveAssignmentsFor: m.getActiveAssignmentsFor,
  getUpcomingAssignmentsFor: m.getUpcomingAssignmentsFor,
  getSelfSelectPackagesFor: m.getSelfSelectPackagesFor,
}));
vi.mock("@/lib/exam/seri-mandiri", () => ({ annotateSeriMandiri: m.annotateSeriMandiri }));
vi.mock("@/lib/billing/entitlements", () => ({ getActiveEntitlement: m.getActiveEntitlement }));

import { GET } from "@/app/api/siswa/ujian/route";

const SEKARANG = new Date("2026-10-08T00:00:00.000Z");
const SISWA_A = { id: "siswa-1", jalur: "A", jenjang: "SMP", schoolId: "sekolah-1" };

const attempt = (id: string, packageId: string, assignmentId: string | null, jam: number, status = "selesai", skorAkhir: number | null = 70) => ({
  id,
  assignmentId,
  packageId,
  status,
  skorAkhir,
  mulaiAt: new Date(Date.UTC(2026, 9, 7, jam)),
  selesaiAt: new Date(Date.UTC(2026, 9, 7, jam, 30)),
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SEKARANG);
  m.requireRole.mockResolvedValue({ id: "user-1", role: "siswa" });
  m.studentFindFirst.mockResolvedValue(SISWA_A);
  m.getActiveAssignmentsFor.mockResolvedValue([{ id: "pen-1" }]);
  m.getUpcomingAssignmentsFor.mockResolvedValue([{ id: "pen-2" }]);
  m.getSelfSelectPackagesFor.mockResolvedValue([]);
  m.annotateSeriMandiri.mockResolvedValue([]);
  m.getActiveEntitlement.mockResolvedValue(null);
  m.attemptFindMany.mockResolvedValue([]);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/siswa/ujian", () => {
  it("bukan siswa -> 403; tanpa profil siswa -> 404", async () => {
    m.requireRole.mockRejectedValueOnce(new Error("x"));
    expect((await GET()).status).toBe(403);
    m.studentFindFirst.mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(404);
  });

  it("memuat jam SERVER, penugasan terbuka, dan penugasan akan datang untuk siswa Jalur A", async () => {
    const body = await (await GET()).json();
    expect(body.sekarang).toBe("2026-10-08T00:00:00.000Z");
    expect(body.assignments).toEqual([{ id: "pen-1" }]);
    expect(body.assignmentsAkanDatang).toEqual([{ id: "pen-2" }]);
    expect(m.getUpcomingAssignmentsFor).toHaveBeenCalledWith(SISWA_A);
  });

  it("siswa mandiri (Jalur B): tidak memuat penugasan sekolah sama sekali", async () => {
    m.studentFindFirst.mockResolvedValue({ ...SISWA_A, jalur: "B", schoolId: null });
    const body = await (await GET()).json();
    expect(body.assignments).toEqual([]);
    expect(body.assignmentsAkanDatang).toEqual([]);
    expect(m.getActiveAssignmentsFor).not.toHaveBeenCalled();
    expect(m.getUpcomingAssignmentsFor).not.toHaveBeenCalled();
  });

  it("SEMUA percobaan dikembalikan (tidak ada yang hilang), masing-masing dengan nomor percobaan per paket+jalur dan waktu selesai", async () => {
    // Urut terbaru dulu (seperti pada kueri); nomor dihitung per kelompok: paket-1 mandiri (3 percobaan), penugasan pen-1 (2), paket-2 (1).
    m.attemptFindMany.mockResolvedValue([
      attempt("p1-c", "paket-1", null, 9, "berjalan", null),
      attempt("pen1-b", "paket-9", "pen-1", 8),
      attempt("p2-a", "paket-2", null, 7),
      attempt("p1-b", "paket-1", null, 6, "kedaluwarsa", 40),
      attempt("pen1-a", "paket-9", "pen-1", 5),
      attempt("p1-a", "paket-1", null, 4),
    ]);
    const body = await (await GET()).json();
    expect(body.attempts).toHaveLength(6);
    const nomor = Object.fromEntries(body.attempts.map((a: { id: string; percobaanKe: number }) => [a.id, a.percobaanKe]));
    expect(nomor).toEqual({ "p1-a": 1, "p1-b": 2, "p1-c": 3, "pen1-a": 1, "pen1-b": 2, "p2-a": 1 });
    expect(body.attempts[0]).toMatchObject({ id: "p1-c", assignmentId: null, packageId: "paket-1", status: "berjalan", skorAkhir: null });
    expect(body.attempts.every((a: { selesaiAt: unknown }) => "selesaiAt" in a)).toBe(true);
  });

  it("kueri percobaan mengambil seluruh riwayat siswa itu, tanpa batas jumlah", async () => {
    await GET();
    const arg = m.attemptFindMany.mock.calls[0]![0];
    expect(arg.where).toEqual({ studentId: "siswa-1" });
    expect(arg.take).toBeUndefined();
    expect(arg.select).toMatchObject({ selesaiAt: true });
  });
});
