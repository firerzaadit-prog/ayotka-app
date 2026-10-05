import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  resolveSchoolId: vi.fn(),
  schoolFindUnique: vi.fn(),
  studentFindMany: vi.fn(),
  studentCount: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/schools/scope", () => ({ resolveSchoolId: m.resolveSchoolId }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    school: { findUnique: m.schoolFindUnique },
    student: { findMany: m.studentFindMany, count: m.studentCount },
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn(), getClientIp: () => "127.0.0.1" }));
vi.mock("@/lib/students/create", () => ({
  assertKuotaTersedia: vi.fn(),
  createStudent: vi.fn(),
  KuotaPenuhError: class extends Error {},
}));

import { GET } from "@/app/api/admin-sekolah/siswa/route";

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "admin-1", role: "admin_sekolah" });
  m.resolveSchoolId.mockResolvedValue("sekolah-1");
  m.schoolFindUnique.mockResolvedValue({ kodeSekolah: "AB12CD" });
  m.studentFindMany.mockResolvedValue([{ id: "s1", nama: "Ayu" }]);
  m.studentCount.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
});

describe("GET /api/admin-sekolah/siswa - Kode Sekolah untuk admin sekolah", () => {
  it("menyertakan kodeSekolah milik sekolah admin itu (dibaca dari sekolah hasil resolveSchoolId)", async () => {
    const res = await GET(new Request("http://localhost/api/admin-sekolah/siswa"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kodeSekolah).toBe("AB12CD");
    expect(body.students).toHaveLength(1);
    expect(body.jumlah).toEqual({ aktif: 5, alumni: 2 });
    expect(m.schoolFindUnique).toHaveBeenCalledWith({ where: { id: "sekolah-1" }, select: { kodeSekolah: true } });
  });

  it("sekolah tidak ditemukan: kodeSekolah null (halaman tidak menampilkan kartu), bukan galat", async () => {
    m.schoolFindUnique.mockResolvedValue(null);
    const body = await (await GET(new Request("http://localhost/api/admin-sekolah/siswa"))).json();
    expect(body.kodeSekolah).toBeNull();
  });

  it("tanpa sekolah terhubung: 400 dan tidak membaca kode apa pun", async () => {
    m.resolveSchoolId.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/admin-sekolah/siswa"));
    expect(res.status).toBe(400);
    expect(m.schoolFindUnique).not.toHaveBeenCalled();
  });

  it("bukan admin: 403", async () => {
    m.requireRole.mockRejectedValue(new Error("x"));
    expect((await GET(new Request("http://localhost/api/admin-sekolah/siswa"))).status).toBe(403);
  });
});
