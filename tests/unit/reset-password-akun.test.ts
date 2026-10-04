import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  userFindUnique: vi.fn(),
  partnerFindUnique: vi.fn(),
  getUserById: vi.fn(),
  updateUserById: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findUnique: m.userFindUnique }, partner: { findUnique: m.partnerFindUnique } },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { getUserById: m.getUserById, updateUserById: m.updateUserById } } }),
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "10.0.0.1" }));

import { aturUlangKataSandiAkun } from "@/lib/auth/reset-password-akun";
import { POST as resetAdminSekolah } from "@/app/api/admin-pusat/school-admins/[id]/reset-password/route";
import { POST as resetDinas } from "@/app/api/admin-pusat/dinas-admins/[id]/reset-password/route";
import { POST as resetMitra } from "@/app/api/admin-pusat/partners/[id]/reset-password/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("http://localhost/x", { method: "POST" });

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
  m.getUserById.mockResolvedValue({ data: { user: { id: "u1", user_metadata: { nama: "Budi", must_change_password: false } } }, error: null });
  m.updateUserById.mockResolvedValue({ error: null });
  m.logAudit.mockResolvedValue(undefined);
});

describe("aturUlangKataSandiAkun", () => {
  const deps = () => ({
    admin: () => ({ auth: { admin: { getUserById: m.getUserById, updateUserById: m.updateUserById } } }) as never,
    buatSandi: () => "SandiBaru-123",
  });

  it("mengatur kata sandi sementara baru dan menandai wajib ganti, dengan data akun lain (nama) dipertahankan", async () => {
    const hasil = await aturUlangKataSandiAkun("u1", deps());
    expect(hasil).toEqual({ ok: true, tempPassword: "SandiBaru-123" });
    expect(m.updateUserById).toHaveBeenCalledWith("u1", {
      password: "SandiBaru-123",
      user_metadata: { nama: "Budi", must_change_password: true },
    });
  });

  it("akun tanpa metadata sama sekali tetap berhasil", async () => {
    m.getUserById.mockResolvedValue({ data: { user: { id: "u1", user_metadata: null } }, error: null });
    expect((await aturUlangKataSandiAkun("u1", deps())).ok).toBe(true);
    expect(m.updateUserById.mock.calls[0]![1].user_metadata).toEqual({ must_change_password: true });
  });

  it("akun login tidak ada di Supabase: 404 dan tidak ada yang diubah", async () => {
    m.getUserById.mockResolvedValue({ data: { user: null }, error: null });
    expect(await aturUlangKataSandiAkun("u1", deps())).toMatchObject({ ok: false, status: 404 });
    expect(m.updateUserById).not.toHaveBeenCalled();
  });

  it("gagal membaca atau gagal mengubah: 502, tanpa kata sandi di pesan galat", async () => {
    m.getUserById.mockResolvedValue({ data: { user: null }, error: { message: "jaringan putus" } });
    const baca = await aturUlangKataSandiAkun("u1", deps());
    expect(baca).toMatchObject({ ok: false, status: 502 });
    expect(m.updateUserById).not.toHaveBeenCalled();

    m.getUserById.mockResolvedValue({ data: { user: { id: "u1", user_metadata: {} } }, error: null });
    m.updateUserById.mockResolvedValue({ error: { message: "Password terlalu lemah" } });
    const ubah = await aturUlangKataSandiAkun("u1", deps());
    expect(ubah).toMatchObject({ ok: false, status: 502 });
    expect(JSON.stringify(ubah)).not.toContain("SandiBaru-123");
  });
});

describe("rute reset password admin pusat", () => {
  const rute = [
    ["admin sekolah", resetAdminSekolah, "admin_sekolah"],
    ["dinas pendidikan", resetDinas, "dinas_pendidikan"],
  ] as const;

  it.each(rute)("%s: 403 bila bukan admin pusat, tanpa menyentuh akun apa pun", async (_nama, panggil) => {
    m.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await panggil(req(), ctx("u1"))).status).toBe(403);
    expect(m.userFindUnique).not.toHaveBeenCalled();
    expect(m.updateUserById).not.toHaveBeenCalled();
  });

  it.each(rute)("%s: berhasil - kata sandi sementara dikembalikan sekali, audit TANPA kata sandi", async (_nama, panggil, peran) => {
    m.userFindUnique.mockResolvedValue({ id: "u1", email: "akun@contoh.id", role: peran });
    const res = await panggil(req(), ctx("u1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.email).toBe("akun@contoh.id");
    expect(json.tempPassword).toMatch(/^\S{16,}$/);
    // kata sandi sama dengan yang dikirim ke Supabase
    expect(m.updateUserById.mock.calls[0]![1]).toMatchObject({ password: json.tempPassword });
    expect(m.logAudit).toHaveBeenCalledTimes(1);
    expect(m.logAudit.mock.calls[0]![0]).toMatchObject({
      userId: "pusat-1",
      aksi: "update",
      entitas: "users",
      entitasId: "u1",
      after: { aksi: "reset_password", peran },
    });
    expect(JSON.stringify(m.logAudit.mock.calls)).not.toContain(json.tempPassword);
  });

  it.each(rute)("%s: akun tidak ada atau berperan lain -> 404 dan kata sandi tidak diubah", async (_nama, panggil, peran) => {
    m.userFindUnique.mockResolvedValue(null);
    expect((await panggil(req(), ctx("tidak-ada"))).status).toBe(404);
    for (const lain of ["siswa", "admin_pusat", "mitra", "admin_sekolah", "dinas_pendidikan"].filter((r) => r !== peran)) {
      m.userFindUnique.mockResolvedValue({ id: "u9", email: "x@y.id", role: lain });
      expect((await panggil(req(), ctx("u9"))).status).toBe(404);
    }
    expect(m.updateUserById).not.toHaveBeenCalled();
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it.each(rute)("%s: gagal di Supabase -> 502 dan tidak dicatat sebagai reset berhasil", async (_nama, panggil, peran) => {
    m.userFindUnique.mockResolvedValue({ id: "u1", email: "akun@contoh.id", role: peran });
    m.updateUserById.mockResolvedValue({ error: { message: "gangguan" } });
    const res = await panggil(req(), ctx("u1"));
    expect(res.status).toBe(502);
    expect((await res.json()).tempPassword).toBeUndefined();
    expect(m.logAudit).not.toHaveBeenCalled();
  });
});

describe("rute reset password mitra (id = id mitra, bukan id akun)", () => {
  it("403 bila bukan admin pusat", async () => {
    m.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await resetMitra(req(), ctx("p1"))).status).toBe(403);
    expect(m.partnerFindUnique).not.toHaveBeenCalled();
  });

  it("berhasil: id mitra diterjemahkan ke akun loginnya dan hanya akun berperan mitra yang direset", async () => {
    m.partnerFindUnique.mockResolvedValue({ userId: "u-mitra" });
    m.userFindUnique.mockResolvedValue({ id: "u-mitra", email: "mitra@contoh.id", role: "mitra" });
    const res = await resetMitra(req(), ctx("p1"));
    expect(res.status).toBe(200);
    expect(m.partnerFindUnique.mock.calls[0]![0].where).toEqual({ id: "p1" });
    expect(m.updateUserById.mock.calls[0]![0]).toBe("u-mitra");
    expect(m.logAudit.mock.calls[0]![0]).toMatchObject({ entitasId: "u-mitra", after: { aksi: "reset_password", peran: "mitra" } });
  });

  it("mitra tidak ada: 404; akun tertaut bukan berperan mitra: 404 tanpa mengubah apa pun", async () => {
    m.partnerFindUnique.mockResolvedValue(null);
    expect((await resetMitra(req(), ctx("tidak-ada"))).status).toBe(404);
    m.partnerFindUnique.mockResolvedValue({ userId: "u-lain" });
    m.userFindUnique.mockResolvedValue({ id: "u-lain", email: "x@y.id", role: "admin_pusat" });
    expect((await resetMitra(req(), ctx("p1"))).status).toBe(404);
    expect(m.updateUserById).not.toHaveBeenCalled();
  });
});
