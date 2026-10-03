import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  resolveSchoolId: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  updateUserById: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/schools/scope", () => ({ resolveSchoolId: m.resolveSchoolId }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { student: { findUnique: m.findUnique, update: m.update } } }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ auth: { admin: { updateUserById: m.updateUserById } } }) }));

import { bisaDikelolaAdmin, loadSiswaKelolaan } from "@/lib/students/kelolaan";
import { POST as resetPassword } from "@/app/api/admin-sekolah/siswa/[id]/reset-password/route";
import { POST as resetKodeKlaim } from "@/app/api/admin-sekolah/siswa/[id]/reset-kode-klaim/route";
import { PATCH as ubahSiswa } from "@/app/api/admin-sekolah/siswa/[id]/route";

const USER = { id: "admin-1", role: "admin_sekolah" } as never;
const SISWA_A = {
  id: "s1",
  schoolId: "sch-1",
  jalur: "A",
  userId: "u1",
  claimStatus: "belum_klaim",
  deletedAt: null,
};
const SISWA_B = { ...SISWA_A, jalur: "B" };
const ctx = { params: Promise.resolve({ id: "s1" }) };
const post = () => new Request("http://localhost/x", { method: "POST" });
const patch = () =>
  new Request("http://localhost/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nama: "Nama Baru" }),
  });

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue(USER);
  m.resolveSchoolId.mockResolvedValue("sch-1");
  // findUnique dipakai untuk mencari siswa (by id) dan untuk cek keunikan kode klaim (by claimToken).
  m.findUnique.mockImplementation(async ({ where }: { where: { id?: string; claimToken?: string } }) =>
    where.id ? SISWA_A : null,
  );
  m.update.mockImplementation(async ({ data }: { data: object }) => ({ ...SISWA_A, ...data }));
  m.updateUserById.mockResolvedValue({ error: null });
});

describe("bisaDikelolaAdmin", () => {
  it("hanya Jalur A yang terikat sekolah dan belum dihapus", () => {
    expect(bisaDikelolaAdmin({ jalur: "A", schoolId: "x", deletedAt: null })).toBe(true);
    expect(bisaDikelolaAdmin({ jalur: "B", schoolId: "x", deletedAt: null })).toBe(false);
    expect(bisaDikelolaAdmin({ jalur: "A", schoolId: null, deletedAt: null })).toBe(false);
    expect(bisaDikelolaAdmin({ jalur: "A", schoolId: "x", deletedAt: new Date() })).toBe(false);
  });
});

describe("loadSiswaKelolaan", () => {
  it("mengembalikan siswa Jalur A di sekolah yang berhak", async () => {
    expect(await loadSiswaKelolaan(USER, "s1")).toEqual(SISWA_A);
  });

  it.each([
    ["tidak ada", null],
    ["Jalur B (mandiri)", SISWA_B],
    ["sudah dihapus", { ...SISWA_A, deletedAt: new Date() }],
    ["tanpa sekolah", { ...SISWA_A, schoolId: null }],
  ])("null kalau siswa %s", async (_nama, siswa) => {
    m.findUnique.mockResolvedValue(siswa);
    expect(await loadSiswaKelolaan(USER, "s1")).toBeNull();
  });

  it("null kalau sekolah siswa bukan sekolah milik admin", async () => {
    m.resolveSchoolId.mockResolvedValue("sch-lain");
    expect(await loadSiswaKelolaan(USER, "s1")).toBeNull();
  });
});

describe("reset password - siswa mandiri tidak boleh direset admin sekolah", () => {
  it("Jalur A dengan akun: berhasil, kata sandi sementara dikembalikan dan diaudit", async () => {
    const res = await resetPassword(post(), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).tempPassword).toBeTruthy();
    expect(m.updateUserById).toHaveBeenCalledWith("u1", expect.objectContaining({ user_metadata: { must_change_password: true } }));
    expect(m.logAudit).toHaveBeenCalled();
  });

  it("Jalur B: 404 dan akun TIDAK disentuh (mencegah pengambilalihan akun siswa mandiri)", async () => {
    m.findUnique.mockResolvedValue(SISWA_B);
    expect((await resetPassword(post(), ctx)).status).toBe(404);
    expect(m.updateUserById).not.toHaveBeenCalled();
  });

  it("siswa belum punya akun: 404 dengan pesan khusus", async () => {
    m.findUnique.mockResolvedValue({ ...SISWA_A, userId: null });
    const res = await resetPassword(post(), ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/belum punya akun/i);
  });

  it("sekolah lain: 404", async () => {
    m.resolveSchoolId.mockResolvedValue("sch-lain");
    expect((await resetPassword(post(), ctx)).status).toBe(404);
    expect(m.updateUserById).not.toHaveBeenCalled();
  });

  it("403 kalau bukan admin", async () => {
    m.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await resetPassword(post(), ctx)).status).toBe(403);
  });
});

describe("reset kode klaim", () => {
  it("Jalur A belum klaim: kode baru dibuat", async () => {
    const res = await resetKodeKlaim(post(), ctx);
    expect(res.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "s1" } }));
  });

  it("Jalur B: 404 dan tidak ada yang diubah", async () => {
    m.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) => (where.id ? SISWA_B : null));
    expect((await resetKodeKlaim(post(), ctx)).status).toBe(404);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("sudah klaim: 409", async () => {
    m.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) =>
      where.id ? { ...SISWA_A, claimStatus: "sudah_klaim" } : null,
    );
    expect((await resetKodeKlaim(post(), ctx)).status).toBe(409);
    expect(m.update).not.toHaveBeenCalled();
  });
});

describe("ubah data siswa", () => {
  it("Jalur A: berhasil", async () => {
    expect((await ubahSiswa(patch(), ctx)).status).toBe(200);
    expect(m.update).toHaveBeenCalled();
  });

  it("Jalur B: 404 dan tidak ada yang diubah", async () => {
    m.findUnique.mockResolvedValue(SISWA_B);
    expect((await ubahSiswa(patch(), ctx)).status).toBe(404);
    expect(m.update).not.toHaveBeenCalled();
  });
});
