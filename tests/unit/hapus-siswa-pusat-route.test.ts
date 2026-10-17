import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  studentFindUnique: vi.fn(),
  studentFindMany: vi.fn(),
  userFindMany: vi.fn(),
  logAudit: vi.fn(),
  hapusSiswa: vi.fn(),
  hapusSiswaMassal: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    student: { findUnique: m.studentFindUnique, findMany: m.studentFindMany },
    user: { findMany: m.userFindMany },
  },
}));
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

import { DELETE } from "@/app/api/admin-pusat/siswa/[id]/route";
import { POST } from "@/app/api/admin-pusat/siswa/hapus-massal/route";
import { GagalHapusAkunLoginError } from "@/lib/students/hapus";

const ctx = { params: Promise.resolve({ id: "s1" }) };
const reqHapus = () => new Request("http://localhost/api/admin-pusat/siswa/s1", { method: "DELETE" });

const MANDIRI = { id: "s1", schoolId: "sch-1", jalur: "B", userId: "u1", nisn: null, nama: "Tomi", deletedAt: null, user: { email: "tomi@contoh.id" } };
const SEKOLAH = { id: "s2", schoolId: "sch-1", jalur: "A", userId: "u2", nisn: "3156140153", nama: "Budi", deletedAt: null, user: { email: "3156140153@nisn.ayotka.id" } };
const tanpaUser = ({ user: _u, ...sisa }: typeof MANDIRI | typeof SEKOLAH) => sisa;

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
  m.studentFindUnique.mockResolvedValue(MANDIRI);
});

describe("DELETE /api/admin-pusat/siswa/[id]", () => {
  it("hanya admin pusat: admin sekolah / siswa mendapat 403 dan tidak ada yang dihapus", async () => {
    m.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await DELETE(reqHapus(), ctx)).status).toBe(403);
    expect(m.requireRole).toHaveBeenCalledWith("admin_pusat");
    expect(m.hapusSiswa).not.toHaveBeenCalled();
  });

  it.each([
    ["siswa tidak ada", null],
    ["siswa sudah dihapus (arsip)", { ...MANDIRI, deletedAt: new Date() }],
  ])("404 kalau %s", async (_nama, siswa) => {
    m.studentFindUnique.mockResolvedValue(siswa);
    expect((await DELETE(reqHapus(), ctx)).status).toBe(404);
    expect(m.hapusSiswa).not.toHaveBeenCalled();
  });

  it("siswa MANDIRI (Jalur B) boleh dihapus - berbeda dari rute admin sekolah", async () => {
    m.hapusSiswa.mockResolvedValue("permanen");
    const res = await DELETE(reqHapus(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, mode: "permanen" });
    // yang diserahkan ke logika hapus adalah baris siswa tanpa data tambahan (user)
    expect(m.hapusSiswa.mock.calls[0]![1]).toEqual(tanpaUser(MANDIRI));
  });

  it("siswa sekolah (Jalur A) juga boleh dihapus lewat rute pusat", async () => {
    m.studentFindUnique.mockResolvedValue(SEKOLAH);
    m.hapusSiswa.mockResolvedValue("arsip");
    const res = await DELETE(reqHapus(), ctx);
    expect(await res.json()).toEqual({ ok: true, mode: "arsip" });
  });

  it("audit mencatat siapa yang menghapus, data siswa sebelumnya, dan EMAIL akun (satu-satunya jejak setelah akun dihapus)", async () => {
    m.hapusSiswa.mockResolvedValue("arsip");
    await DELETE(reqHapus(), ctx);
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "pusat-1",
        aksi: "delete",
        entitas: "students",
        entitasId: "s1",
        before: { ...tanpaUser(MANDIRI), email: "tomi@contoh.id" },
        after: expect.objectContaining({ diarsipkan: true, nisn: null }),
      }),
    );
  });

  it("siswa tanpa akun login (belum klaim): audit email null, tetap terhapus", async () => {
    m.studentFindUnique.mockResolvedValue({ ...SEKOLAH, userId: null, user: null });
    m.hapusSiswa.mockResolvedValue("permanen");
    const res = await DELETE(reqHapus(), ctx);
    expect(res.status).toBe(200);
    expect(m.logAudit).toHaveBeenCalledWith(expect.objectContaining({ before: expect.objectContaining({ email: null }) }));
  });

  it("akun login gagal dihapus: 502 yang menegaskan tidak ada data berubah, tanpa audit", async () => {
    m.hapusSiswa.mockRejectedValue(new GagalHapusAkunLoginError());
    const res = await DELETE(reqHapus(), ctx);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/tidak ada data yang berubah/i);
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("galat tak terduga tidak ditelan", async () => {
    m.hapusSiswa.mockRejectedValue(new Error("db mati"));
    await expect(DELETE(reqHapus(), ctx)).rejects.toThrow("db mati");
  });
});

describe("POST /api/admin-pusat/siswa/hapus-massal", () => {
  const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const S = (n: number, o: Record<string, unknown> = {}) => ({
    id: ID(n),
    schoolId: "sch-1",
    jalur: n % 2 === 0 ? "B" : "A",
    userId: `user-${n}`,
    nisn: null,
    nama: `Siswa ${n}`,
    deletedAt: null,
    ...o,
  });
  const req = (body: unknown) =>
    new Request("http://localhost/api/admin-pusat/siswa/hapus-massal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  beforeEach(() => {
    m.studentFindMany.mockResolvedValue([S(1), S(2), S(3)]);
    m.userFindMany.mockResolvedValue([
      { id: "user-1", email: "satu@contoh.id" },
      { id: "user-2", email: "dua@contoh.id" },
      { id: "user-3", email: "tiga@contoh.id" },
    ]);
    m.hapusSiswaMassal.mockImplementation(async (_deps: unknown, daftar: { id: string }[]) => ({
      permanen: daftar.map((s) => s.id),
      arsip: [],
      gagal: [],
    }));
  });

  it("hanya admin pusat", async () => {
    m.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await POST(req({ ids: [ID(1)] }))).status).toBe(403);
    expect(m.requireRole).toHaveBeenCalledWith("admin_pusat");
    expect(m.hapusSiswaMassal).not.toHaveBeenCalled();
  });

  it.each([
    ["bukan JSON", "bukan json"],
    ["tanpa ids", {}],
    ["ids kosong", { ids: [] }],
    ["id bukan UUID", { ids: ["abc"] }],
    ["lebih dari 200 id", { ids: Array.from({ length: 201 }, (_, i) => ID(i + 1)) }],
  ])("400 untuk %s", async (_nama, body) => {
    expect((await POST(req(body))).status).toBe(400);
    expect(m.hapusSiswaMassal).not.toHaveBeenCalled();
  });

  it("mencari siswa TANPA batasan jalur atau sekolah (Jalur A dan B ikut), hanya yang belum dihapus", async () => {
    await POST(req({ ids: [ID(1), ID(2), ID(3)] }));
    expect(m.studentFindMany).toHaveBeenCalledWith({ where: { id: { in: [ID(1), ID(2), ID(3)] }, deletedAt: null } });
    const diserahkan = m.hapusSiswaMassal.mock.calls[0]![1] as { jalur: string }[];
    expect(diserahkan.map((s) => s.jalur).sort()).toEqual(["A", "A", "B"]);
  });

  it("ID ganda dibuang; ID yang tidak ditemukan dihitung di tidakDitemukan", async () => {
    m.studentFindMany.mockResolvedValue([S(1)]);
    const res = await POST(req({ ids: [ID(1), ID(1), ID(9)] }));
    expect(m.studentFindMany).toHaveBeenCalledWith({ where: { id: { in: [ID(1), ID(9)] }, deletedAt: null } });
    expect(await res.json()).toEqual({ dihapus: 1, diarsipkan: 0, gagal: 0, tidakDitemukan: 1 });
  });

  it("ringkasan: permanen, arsip, dan gagal dihitung terpisah", async () => {
    m.hapusSiswaMassal.mockResolvedValue({ permanen: [ID(1)], arsip: [ID(2)], gagal: [ID(3)] });
    const res = await POST(req({ ids: [ID(1), ID(2), ID(3)] }));
    expect(await res.json()).toEqual({ dihapus: 1, diarsipkan: 1, gagal: 1, tidakDitemukan: 0 });
  });

  it("audit per siswa yang diproses (bukan yang gagal), memuat email akun masing-masing dan mode hapus", async () => {
    m.hapusSiswaMassal.mockResolvedValue({ permanen: [ID(1)], arsip: [ID(2)], gagal: [ID(3)] });
    await POST(req({ ids: [ID(1), ID(2), ID(3)] }));
    expect(m.logAudit).toHaveBeenCalledTimes(2);
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "pusat-1", entitasId: ID(1), before: expect.objectContaining({ email: "satu@contoh.id" }), after: { dihapusPermanen: true } }),
    );
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entitasId: ID(2), before: expect.objectContaining({ email: "dua@contoh.id" }), after: expect.objectContaining({ diarsipkan: true }) }),
    );
    expect(m.logAudit).not.toHaveBeenCalledWith(expect.objectContaining({ entitasId: ID(3) }));
  });

  it("siswa tanpa akun: email audit null dan tidak ada pencarian akun yang sia-sia", async () => {
    m.studentFindMany.mockResolvedValue([S(1, { userId: null })]);
    await POST(req({ ids: [ID(1)] }));
    expect(m.userFindMany).not.toHaveBeenCalled();
    expect(m.logAudit).toHaveBeenCalledWith(expect.objectContaining({ before: expect.objectContaining({ email: null }) }));
  });

  it("tidak ada yang ditemukan: tetap 200 dengan ringkasan nol", async () => {
    m.studentFindMany.mockResolvedValue([]);
    m.hapusSiswaMassal.mockResolvedValue({ permanen: [], arsip: [], gagal: [] });
    const res = await POST(req({ ids: [ID(1)] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ dihapus: 0, diarsipkan: 0, gagal: 0, tidakDitemukan: 1 });
    expect(m.logAudit).not.toHaveBeenCalled();
  });
});
