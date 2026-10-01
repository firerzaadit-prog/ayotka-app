import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  loadOwnedAttempt: vi.fn(),
  checkAndClaimSession: vi.fn(),
  answerFindMany: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/exam/attempt-access", () => ({
  loadOwnedAttempt: m.loadOwnedAttempt,
  // Sama seperti aslinya: buang kolom internal sebelum dikirim ke klien.
  sanitizeAttemptForClient: (a: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { activeTabToken, activeTabLastSeen, aiAnalysisProcessingAt, aiAnalysisLastError, ...rest } = a;
    return rest;
  },
}));
vi.mock("@/lib/exam/session-guard", () => ({ checkAndClaimSession: m.checkAndClaimSession }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { attemptAnswer: { findMany: m.answerFindMany } } }));

import { GET } from "@/app/api/siswa/attempts/[id]/sinkron/route";

function req(tabToken?: string) {
  const url = new URL(`http://localhost/api/siswa/attempts/att-1/sinkron${tabToken ? `?tabToken=${tabToken}` : ""}`);
  return { nextUrl: url } as unknown as NextRequest;
}
const ctx = { params: Promise.resolve({ id: "att-1" }) };

const BERJALAN = {
  id: "att-1",
  status: "berjalan",
  mulaiAt: new Date(Date.now() - 60_000),
  sisaDetik: 600,
  activeTabToken: "RAHASIA",
  activeTabLastSeen: new Date(),
  aiAnalysisProcessingAt: null,
  aiAnalysisLastError: "detail internal",
};

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "user-1", role: "siswa" });
  m.loadOwnedAttempt.mockResolvedValue(BERJALAN);
  m.checkAndClaimSession.mockResolvedValue(true);
  m.answerFindMany.mockResolvedValue([{ questionId: "q1", jawabanJson: { option_id: "o1" }, ragu: false }]);
});

describe("GET /api/siswa/attempts/[id]/sinkron - penyegaran ringan halaman ujian", () => {
  it("403 kalau bukan siswa", async () => {
    m.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await GET(req("t"), ctx)).status).toBe(403);
  });

  it("404 kalau attempt bukan milik siswa / tidak ada", async () => {
    m.loadOwnedAttempt.mockResolvedValue(null);
    expect((await GET(req("t"), ctx)).status).toBe(404);
  });

  it("400 kalau berjalan tapi tabToken tidak dikirim (batas satu sesi tidak boleh dilewati)", async () => {
    expect((await GET(req(), ctx)).status).toBe(400);
    expect(m.checkAndClaimSession).not.toHaveBeenCalled();
  });

  it("409 SESI_DIAMBIL_ALIH kalau tab lain sudah memegang sesi", async () => {
    m.checkAndClaimSession.mockResolvedValue(false);
    const res = await GET(req("t"), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("SESI_DIAMBIL_ALIH");
  });

  it("berhasil: status + sisa waktu server + jawaban, TANPA soal, dan tanpa kolom internal", async () => {
    const res = await GET(req("t"), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toBeUndefined();
    expect(body.answers).toEqual([{ questionId: "q1", jawabanJson: { option_id: "o1" }, ragu: false }]);
    expect(body.attempt.status).toBe("berjalan");
    expect(body.attempt.sisaDetik).toBeGreaterThan(0);
    expect(body.attempt.sisaDetik).toBeLessThanOrEqual(600);
    expect(body.attempt).not.toHaveProperty("activeTabToken");
    expect(body.attempt).not.toHaveProperty("aiAnalysisLastError");
    expect(m.checkAndClaimSession).toHaveBeenCalledWith("att-1", "t");
  });

  it("hanya membaca kolom yang perlu dari jawaban (tidak ada kunci/skor)", async () => {
    await GET(req("t"), ctx);
    expect(m.answerFindMany).toHaveBeenCalledWith({
      where: { attemptId: "att-1" },
      select: { questionId: true, jawabanJson: true, ragu: true },
    });
  });

  it.each(["paused", "selesai", "kedaluwarsa"])("status %s: hanya status, tanpa jawaban & tanpa klaim sesi", async (status) => {
    m.loadOwnedAttempt.mockResolvedValue({ ...BERJALAN, status });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attempt.status).toBe(status);
    expect(body.answers).toEqual([]);
    expect(m.checkAndClaimSession).not.toHaveBeenCalled();
    expect(m.answerFindMany).not.toHaveBeenCalled();
  });
});
