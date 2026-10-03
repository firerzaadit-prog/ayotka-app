import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  resolveSchoolId: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  logAudit: vi.fn(),
  hapusSiswa: vi.fn(),
  hapusSiswaMassal: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/schools/scope", () => ({ resolveSchoolId: m.resolveSchoolId }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { student: { findUnique: m.findUnique, findMany: m.findMany } } }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/students/hapus", async (importAsli) => {
  const asli = await importAsli<typeof import("@/lib/students/hapus")>();
  return {
    ...asli,
    hapusSiswa: m.hapusSiswa,
    hapusSiswaMassal: m.hapusSiswaMassal,
    buatPenghapusAkunLogin: () => async () => undefined,
  };
});

import { DELETE } from "@/app/api/admin-sekolah/siswa/[id]/route";
import { POST } from "@/app/api/admin-sekolah/siswa/hapus-massal/route";
import { GagalHapusAkunLoginError } from "@/lib/students/hapus";

const ctx = { params: Promise.resolve({ id: "s1" }) };
const reqHapus = () => new Request("http://localhost/api/admin-sekolah/siswa/s1", { method: "DELETE" });
const SISWA = { id: "s1", schoolId: "sch-1", jalur: "A", userId: "u1", nisn: "3156140153", nama: "Budi", deletedAt: null };

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "admin-1", role: "admin_sekolah" });
  m.findUnique.mockResolvedValue(SISWA);
  m.resolveSchoolId.mockResolvedValue("sch-1");
});

describe("DELETE /api/admin-sekolah/siswa/[id]", () => {
  it("403 kalau bukan admin", async () => {
    m.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await DELETE(reqHapus(), ctx)).status).toBe(403);
    expect(m.hapusSiswa).not.toHaveBeenCalled();
  });

  it.each([
    ["siswa tidak ada", null],
    ["siswa sudah dihapus", { ...SISWA, deletedAt: new Date() }],
  ])("404 kalau %s", async (_nama, siswa) => {
    m.findUnique.mockResolvedValue(siswa);
    expect((await DELETE(reqHapus(), ctx)).status).toBe(404);
    expect(m.hapusSiswa).not.toHaveBeenCalled();
  });

  it("404 kalau siswa mandiri (Jalur B): bukan milik sekolah walau punya schoolId", async () => {
    m.findUnique.mockResolvedValue({ ...SISWA, jalur: "B" });
    expect((await DELETE(reqHapus(), ctx)).status).toBe(404);
    expect(m.hapusSiswa).not.toHaveBeenCalled();
  });

  it("404 kalau siswa milik sekolah lain (admin sekolah tidak boleh menghapus siswa sekolah lain)", async () => {
    m.resolveSchoolId.mockResolvedValue("sch-lain");
    expect((await DELETE(reqHapus(), ctx)).status).toBe(404);
    expect(m.hapusSiswa).not.toHaveBeenCalled();
  });

  it("dihapus permanen: 200, audit mencatat data siswa sebelum dihapus (NISN asli tetap terlacak)", async () => {
    m.hapusSiswa.mockResolvedValue("permanen");
    const res = await DELETE(reqHapus(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, mode: "permanen" });
    expect(m.hapusSiswa.mock.calls[0]![1]).toBe(SISWA);
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ aksi: "delete", entitas: "students", entitasId: "s1", before: SISWA, after: { dihapusPermanen: true } }),
    );
  });

  it("diarsipkan (punya riwayat): 200 dan audit mencatat bahwa identitasnya dibebaskan", async () => {
    m.hapusSiswa.mockResolvedValue("arsip");
    const res = await DELETE(reqHapus(), ctx);
    expect(await res.json()).toEqual({ ok: true, mode: "arsip" });
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ before: SISWA, after: expect.objectContaining({ diarsipkan: true, nisn: null }) }),
    );
  });

  it("akun login gagal dihapus: 502 dengan pesan jelas, tidak ada audit (tidak ada data yang berubah)", async () => {
    m.hapusSiswa.mockRejectedValue(new GagalHapusAkunLoginError());
    const res = await DELETE(reqHapus(), ctx);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/coba lagi/i);
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("galat tak terduga tidak ditelan", async () => {
    m.hapusSiswa.mockRejectedValue(new Error("db mati"));
    await expect(DELETE(reqHapus(), ctx)).rejects.toThrow("db mati");
  });
});

describe("POST /api/admin-sekolah/siswa/hapus-massal", () => {
  const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const S = (n: number, schoolId = "sch-1") => ({ id: ID(n), schoolId, jalur: "A", userId: null, nisn: `31000000${n}`, nama: `Siswa ${n}`, deletedAt: null });
  const reqMassal = (body: unknown) =>
    new Request("http://localhost/api/admin-sekolah/siswa/hapus-massal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  beforeEach(() => {
    m.findMany.mockResolvedValue([S(1), S(2), S(3)]);
    m.hapusSiswaMassal.mockImplementation(async (_deps: unknown, daftar: { id: string }[]) => ({
      permanen: daftar.map((s) => s.id),
      arsip: [],
      gagal: [],
    }));
  });

  it("403 kalau bukan admin", async () => {
    m.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await POST(reqMassal({ ids: [ID(1)] }))).status).toBe(403);
    expect(m.hapusSiswaMassal).not.toHaveBeenCalled();
  });

  it.each([
    ["bukan JSON", "bukan json"],
    ["tanpa ids", {}],
    ["ids kosong", { ids: [] }],
    ["ID bukan UUID", { ids: ["abc"] }],
    ["lebih dari 200 ID", { ids: Array.from({ length: 201 }, (_, i) => ID(i + 1)) }],
  ])("400 kalau %s", async (_nama, body) => {
    expect((await POST(reqMassal(body))).status).toBe(400);
    expect(m.hapusSiswaMassal).not.toHaveBeenCalled();
  });

  it("hanya mencari siswa Jalur A yang belum dihapus dan terikat sekolah (Jalur B tidak pernah ikut terhapus)", async () => {
    await POST(reqMassal({ ids: [ID(1), ID(2), ID(3)] }));
    expect(m.findMany).toHaveBeenCalledWith({
      where: { id: { in: [ID(1), ID(2), ID(3)] }, jalur: "A", deletedAt: null, schoolId: { not: null } },
    });
  });

  it("berhasil: ringkasan jumlah, tiap siswa diaudit dengan data sebelum dihapus", async () => {
    m.hapusSiswaMassal.mockResolvedValue({ permanen: [ID(1), ID(2)], arsip: [ID(3)], gagal: [] });
    const res = await POST(reqMassal({ ids: [ID(1), ID(2), ID(3)] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ dihapus: 2, diarsipkan: 1, gagal: 0, tidakDitemukan: 0 });
    expect(m.logAudit).toHaveBeenCalledTimes(3);
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ aksi: "delete", entitas: "students", entitasId: ID(1), before: S(1), after: { dihapusPermanen: true } }),
    );
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entitasId: ID(3), after: expect.objectContaining({ diarsipkan: true }) }),
    );
  });

  it("ID duplikat hanya diproses sekali", async () => {
    await POST(reqMassal({ ids: [ID(1), ID(1), ID(2)] }));
    expect(m.findMany.mock.calls[0]![0].where.id.in).toEqual([ID(1), ID(2)]);
  });

  it("siswa yang tidak ditemukan atau sudah dihapus dihitung di tidakDitemukan", async () => {
    m.findMany.mockResolvedValue([S(1)]);
    const res = await POST(reqMassal({ ids: [ID(1), ID(2), ID(3)] }));
    expect((await res.json()).tidakDitemukan).toBe(2);
    expect(m.hapusSiswaMassal.mock.calls[0]![1]).toEqual([S(1)]);
  });

  it("siswa sekolah lain TIDAK diproses walau ID-nya dikirim (admin sekolah tidak boleh lintas sekolah)", async () => {
    m.findMany.mockResolvedValue([S(1), S(2, "sch-lain")]);
    m.resolveSchoolId.mockImplementation(async () => "sch-1"); // admin sekolah selalu terikat ke sekolahnya sendiri
    const res = await POST(reqMassal({ ids: [ID(1), ID(2)] }));
    expect(m.hapusSiswaMassal.mock.calls[0]![1]).toEqual([S(1)]);
    expect((await res.json()).tidakDitemukan).toBe(1);
  });

  it("otorisasi dicek sekali per sekolah, bukan per siswa", async () => {
    await POST(reqMassal({ ids: [ID(1), ID(2), ID(3)] }));
    expect(m.resolveSchoolId).toHaveBeenCalledTimes(1);
  });

  it("sebagian gagal: dilaporkan, dan yang gagal tidak diaudit (datanya tidak berubah)", async () => {
    m.hapusSiswaMassal.mockResolvedValue({ permanen: [ID(1)], arsip: [], gagal: [ID(2), ID(3)] });
    const res = await POST(reqMassal({ ids: [ID(1), ID(2), ID(3)] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ dihapus: 1, diarsipkan: 0, gagal: 2, tidakDitemukan: 0 });
    expect(m.logAudit).toHaveBeenCalledTimes(1);
    expect(m.logAudit).toHaveBeenCalledWith(expect.objectContaining({ entitasId: ID(1) }));
  });
});
