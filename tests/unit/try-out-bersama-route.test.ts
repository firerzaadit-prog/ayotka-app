import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  resolveSchoolId: vi.fn(),
  logAudit: vi.fn(),
  hitungKursiTerpakai: vi.fn(),
  schoolFindUnique: vi.fn(),
  packageFindFirst: vi.fn(),
  packageFindMany: vi.fn(),
  assignmentCreate: vi.fn(),
  assignmentFindMany: vi.fn(),
  assignmentFindUnique: vi.fn(),
  assignmentUpdate: vi.fn(),
  assignmentDelete: vi.fn(),
  attemptFindMany: vi.fn(),
  attemptCount: vi.fn(),
  periodeFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/schools/scope", () => ({ resolveSchoolId: m.resolveSchoolId }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "10.0.0.1" }));
vi.mock("@/lib/students/create", () => ({ hitungKursiTerpakai: m.hitungKursiTerpakai }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    school: { findUnique: m.schoolFindUnique },
    package: { findFirst: m.packageFindFirst, findMany: m.packageFindMany },
    assignment: { create: m.assignmentCreate, findMany: m.assignmentFindMany, findUnique: m.assignmentFindUnique, update: m.assignmentUpdate },
    attempt: { findMany: m.attemptFindMany },
    periodeLangganan: { findMany: m.periodeFindMany },
    $transaction: m.transaction,
  },
}));

import { GET, POST } from "@/app/api/admin-sekolah/assignments/route";
import { DELETE, PATCH } from "@/app/api/admin-sekolah/assignments/[id]/route";
import { GET as GET_PAKET } from "@/app/api/admin-sekolah/paket-tersedia/route";
import { wherePaketTersedia } from "@/lib/exam/paket-tersedia";

const SEKARANG = new Date("2026-10-08T00:00:00.000Z");
const SEKOLAH = "sekolah-1";
const PAKET = "0f8d3acf-76bd-4d04-871c-769e0124a500";
const ID = "9b1f0c52-9f0c-4c27-9d57-2f7f0d3f6a11";
const PERIODE = { mulai: new Date("2026-09-30T17:00:00Z"), berakhir: new Date("2026-12-31T16:59:59.999Z"), masaTenggangHari: 14, dicabutAt: null };

const req = (url: string, method: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const paramsId = { params: Promise.resolve({ id: ID }) };

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SEKARANG);
  m.requireRole.mockResolvedValue({ id: "user-1", role: "admin_sekolah" });
  m.resolveSchoolId.mockResolvedValue(SEKOLAH);
  m.schoolFindUnique.mockResolvedValue({ jenjang: "SMP" });
  m.periodeFindMany.mockResolvedValue([PERIODE]);
  m.hitungKursiTerpakai.mockResolvedValue(30);
  m.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({ attempt: { count: m.attemptCount }, assignment: { delete: m.assignmentDelete } }),
  );
});
afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/admin-sekolah/assignments - membuat Try Out Bersama", () => {
  const body = { packageId: PAKET, mulai: "2026-10-08T08:00", selesai: "2026-10-08T10:00" };
  const paketSmp = { id: PAKET, jenjang: "SMP" };

  beforeEach(() => {
    m.packageFindFirst.mockResolvedValue(paketSmp);
    m.assignmentCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: ID, ...data }));
  });

  it("bukan admin sekolah/pusat -> 403 dan tidak membuat apa pun", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await POST(req("/x", "POST", body))).status).toBe(403);
    expect(m.assignmentCreate).not.toHaveBeenCalled();
  });

  it("akun tanpa sekolah -> 403", async () => {
    m.resolveSchoolId.mockResolvedValue(null);
    expect((await POST(req("/x", "POST", body))).status).toBe(403);
  });

  it.each([
    [{ ...body, packageId: "bukan-uuid" }, "Paket soal tidak valid."],
    [{ ...body, mulai: "kapan-kapan" }, "Format waktu tidak valid."],
    [{ ...body, selesai: "2026-10-08T07:00" }, "Waktu selesai harus setelah waktu mulai."],
  ])("masukan tidak sah -> 400 dengan pesan jelas", async (isi, pesan) => {
    const res = await POST(req("/x", "POST", isi));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(pesan);
    expect(m.assignmentCreate).not.toHaveBeenCalled();
  });

  it("paket yang tidak tersedia untuk sekolah ini (aturan yang SAMA dengan daftar pilihan) -> 404", async () => {
    m.packageFindFirst.mockResolvedValue(null);
    const res = await POST(req("/x", "POST", body));
    expect(res.status).toBe(404);
    expect(m.packageFindFirst).toHaveBeenCalledWith({ where: { id: PAKET, ...wherePaketTersedia(SEKOLAH) } });
    expect(m.assignmentCreate).not.toHaveBeenCalled();
  });

  it("paket jenjang lain -> 400 JENJANG_BEDA dengan pesan yang menyebut kedua jenjang", async () => {
    m.packageFindFirst.mockResolvedValue({ id: PAKET, jenjang: "SD" });
    const res = await POST(req("/x", "POST", body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("JENJANG_BEDA");
    expect(json.error).toContain("SD");
    expect(json.error).toContain("SMP");
    expect(m.assignmentCreate).not.toHaveBeenCalled();
  });

  it("jadwal yang sudah lewat -> 400 JADWAL_LEWAT", async () => {
    const res = await POST(req("/x", "POST", { ...body, mulai: "2026-10-06T08:00", selesai: "2026-10-07T10:00" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("JADWAL_LEWAT");
    expect(m.assignmentCreate).not.toHaveBeenCalled();
  });

  it("sekolah tanpa langganan -> 403 TANPA_LANGGANAN", async () => {
    m.periodeFindMany.mockResolvedValue([]);
    const res = await POST(req("/x", "POST", body));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("TANPA_LANGGANAN");
    expect(m.assignmentCreate).not.toHaveBeenCalled();
  });

  it("jadwal di luar masa langganan -> 403 DI_LUAR_LANGGANAN", async () => {
    const res = await POST(req("/x", "POST", { ...body, mulai: "2027-03-01T08:00", selesai: "2027-03-01T10:00" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("DI_LUAR_LANGGANAN");
  });

  it("berhasil: jam yang diketik dibaca sebagai WIB (08.00 -> 01.00 UTC), tersimpan untuk sekolah dari sesi, dan dicatat audit", async () => {
    const res = await POST(req("/x", "POST", { ...body, schoolId: "sekolah-lain" }));
    expect(res.status).toBe(201);
    expect(m.assignmentCreate).toHaveBeenCalledTimes(1);
    const data = m.assignmentCreate.mock.calls[0]![0].data;
    expect(data.packageId).toBe(PAKET);
    expect(data.schoolId).toBe(SEKOLAH);
    expect((data.mulai as Date).toISOString()).toBe("2026-10-08T01:00:00.000Z");
    expect((data.selesai as Date).toISOString()).toBe("2026-10-08T03:00:00.000Z");
    expect(m.logAudit).toHaveBeenCalledWith(expect.objectContaining({ aksi: "create", entitas: "assignments", entitasId: ID, userId: "user-1" }));
  });
});

describe("GET /api/admin-sekolah/assignments - daftar", () => {
  const baris = (id: string, ownerType: "pusat" | "sekolah", attempts: number) => ({
    id,
    packageId: PAKET,
    schoolId: SEKOLAH,
    mulai: new Date("2026-10-08T01:00:00Z"),
    selesai: new Date("2026-10-08T03:00:00Z"),
    isActive: true,
    package: { nama: `Paket ${id}`, jumlahSoal: 30, durasiMenit: 60, kategori: "mandiri", ownerType, subject: { nama: "Matematika" } },
    _count: { attempts },
  });

  it("hanya penugasan sekolah dari sesi; memuat jam server, jumlah siswa, label sumber, dan siswa selesai per SISWA", async () => {
    m.assignmentFindMany.mockResolvedValue([baris("a1", "pusat", 3), baris("a2", "sekolah", 0)]);
    m.attemptFindMany.mockResolvedValue([
      { assignmentId: "a1", studentId: "s1" },
      { assignmentId: "a1", studentId: "s2" },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(m.assignmentFindMany.mock.calls[0]![0].where).toEqual({ schoolId: SEKOLAH });
    expect(m.attemptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assignmentId: { in: ["a1", "a2"] }, status: { in: ["selesai", "kedaluwarsa"] } },
        distinct: ["assignmentId", "studentId"],
      }),
    );
    expect(json.sekarang).toBe("2026-10-08T00:00:00.000Z");
    expect(json.jumlahSiswa).toBe(30);
    expect(json.assignments.map((a: { id: string; siswaSelesai: number; package: { dirilisPusat: boolean; mapel: string } }) => [a.id, a.siswaSelesai, a.package.dirilisPusat, a.package.mapel])).toEqual([
      ["a1", 2, true, "Matematika"],
      ["a2", 0, false, "Matematika"],
    ]);
  });

  it("tanpa penugasan: tidak perlu menghitung percobaan", async () => {
    m.assignmentFindMany.mockResolvedValue([]);
    const res = await GET();
    expect((await res.json()).assignments).toEqual([]);
    expect(m.attemptFindMany).not.toHaveBeenCalled();
  });

  it("bukan admin -> 403", async () => {
    m.requireRole.mockRejectedValue(new Error("x"));
    expect((await GET()).status).toBe(403);
  });
});

describe("GET /api/admin-sekolah/paket-tersedia", () => {
  it("hanya jenjang sekolah ini, dengan aturan penyaring bersama dan label 'dirilis pusat'", async () => {
    m.packageFindMany.mockResolvedValue([
      { id: "p1", nama: "A", jumlahSoal: 30, durasiMenit: 60, jenjang: "SMP", kategori: "mandiri", ownerType: "pusat", publishedAt: null, subject: { id: "s", nama: "Matematika" } },
      { id: "p2", nama: "B", jumlahSoal: 20, durasiMenit: 40, jenjang: "SMP", kategori: "nasional", ownerType: "sekolah", publishedAt: null, subject: { id: "s", nama: "IPA" } },
    ]);
    const res = await GET_PAKET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(m.packageFindMany.mock.calls[0]![0].where).toEqual(wherePaketTersedia(SEKOLAH, { jenjang: "SMP" }));
    expect(json.jenjang).toBe("SMP");
    expect(json.packages.map((p: { id: string; dirilisPusat: boolean }) => [p.id, p.dirilisPusat])).toEqual([["p1", true], ["p2", false]]);
    expect(json.packages[0]).not.toHaveProperty("ownerType");
  });

  it("sekolah tidak ditemukan -> 404; bukan admin -> 403", async () => {
    m.schoolFindUnique.mockResolvedValue(null);
    expect((await GET_PAKET()).status).toBe(404);
    m.requireRole.mockRejectedValue(new Error("x"));
    expect((await GET_PAKET()).status).toBe(403);
  });
});

describe("PATCH /api/admin-sekolah/assignments/[id] - ubah jadwal / aktifkan", () => {
  const sebelum = {
    id: ID,
    packageId: PAKET,
    schoolId: SEKOLAH,
    mulai: new Date("2026-10-08T01:00:00.000Z"),
    selesai: new Date("2026-10-08T03:00:00.000Z"),
    isActive: true,
  };
  const ubah = (isi: unknown) => PATCH(req(`/x/${ID}`, "PATCH", isi), paramsId);

  beforeEach(() => {
    m.assignmentFindUnique.mockResolvedValue(sebelum);
    m.assignmentUpdate.mockImplementation(async ({ data }: { data: object }) => ({ ...sebelum, ...data }));
  });

  it("penugasan sekolah lain atau tidak ada -> 404 dan tidak diubah", async () => {
    m.assignmentFindUnique.mockResolvedValue({ ...sebelum, schoolId: "sekolah-lain" });
    expect((await ubah({ isActive: false })).status).toBe(404);
    m.assignmentFindUnique.mockResolvedValue(null);
    expect((await ubah({ isActive: false })).status).toBe(404);
    expect(m.assignmentUpdate).not.toHaveBeenCalled();
  });

  it("hanya mengaktifkan/menonaktifkan: tidak memeriksa jadwal maupun langganan", async () => {
    const res = await ubah({ isActive: false });
    expect(res.status).toBe(200);
    expect(m.periodeFindMany).not.toHaveBeenCalled();
    expect(m.assignmentUpdate).toHaveBeenCalledWith({ where: { id: ID }, data: { isActive: false } });
  });

  it("mengubah selesai (diperpanjang): dibaca sebagai WIB, divalidasi, dicatat audit sebelum/sesudah", async () => {
    const res = await ubah({ selesai: "2026-10-09T12:00" });
    expect(res.status).toBe(200);
    const data = m.assignmentUpdate.mock.calls[0]![0].data;
    expect((data.selesai as Date).toISOString()).toBe("2026-10-09T05:00:00.000Z");
    expect(data.mulai).toBeUndefined();
    expect(m.logAudit).toHaveBeenCalledWith(expect.objectContaining({ aksi: "update", entitas: "assignments", entitasId: ID, before: sebelum }));
  });

  it("memperpanjang jendela yang SUDAH tutup (membuka lagi) diperbolehkan selama selesai baru di masa depan", async () => {
    m.assignmentFindUnique.mockResolvedValue({ ...sebelum, mulai: new Date("2026-10-01T01:00:00Z"), selesai: new Date("2026-10-02T03:00:00Z") });
    expect((await ubah({ selesai: "2026-10-10T12:00" })).status).toBe(200);
  });

  it("selesai baru sebelum mulai lama -> 400 (urutan dicek dari nilai akhir)", async () => {
    const res = await ubah({ selesai: "2026-10-08T07:00" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Waktu selesai harus setelah waktu mulai.");
    expect(m.assignmentUpdate).not.toHaveBeenCalled();
  });

  it("mulai baru sesudah selesai lama -> 400", async () => {
    expect((await ubah({ mulai: "2026-10-08T12:00" })).status).toBe(400);
  });

  it("jadwal yang seluruhnya sudah lewat -> 400 JADWAL_LEWAT", async () => {
    const res = await ubah({ mulai: "2026-10-06T08:00", selesai: "2026-10-07T08:00" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("JADWAL_LEWAT");
    expect(m.assignmentUpdate).not.toHaveBeenCalled();
  });

  it("jadwal di luar masa langganan -> 403 DI_LUAR_LANGGANAN", async () => {
    const res = await ubah({ mulai: "2027-03-01T08:00", selesai: "2027-03-01T10:00" });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("DI_LUAR_LANGGANAN");
  });

  it("badan kosong atau waktu rusak -> 400", async () => {
    expect((await ubah({})).status).toBe(400);
    const rusak = await ubah({ mulai: "bukan waktu" });
    expect(rusak.status).toBe(400);
    expect((await rusak.json()).error).toBe("Format waktu tidak valid.");
  });

  it("paket dan sekolah tidak bisa diubah lewat badan permintaan (hanya mulai, selesai, isActive)", async () => {
    await ubah({ isActive: true, packageId: "lain", schoolId: "lain" });
    expect(m.assignmentUpdate.mock.calls[0]![0].data).toEqual({ isActive: true });
  });
});

describe("DELETE /api/admin-sekolah/assignments/[id] - hapus", () => {
  const dasar = {
    id: ID,
    packageId: PAKET,
    schoolId: SEKOLAH,
    mulai: new Date("2026-10-09T01:00:00.000Z"), // besok: akan datang
    selesai: new Date("2026-10-09T03:00:00.000Z"),
    isActive: true,
  };
  const hapus = () => DELETE(req(`/x/${ID}`, "DELETE"), paramsId);

  beforeEach(() => {
    m.assignmentFindUnique.mockResolvedValue(dasar);
    m.attemptCount.mockResolvedValue(0);
    m.assignmentDelete.mockResolvedValue({});
  });

  it("penugasan sekolah lain atau tidak ada -> 404 dan tidak dihapus", async () => {
    m.assignmentFindUnique.mockResolvedValue({ ...dasar, schoolId: "sekolah-lain" });
    expect((await hapus()).status).toBe(404);
    expect(m.assignmentDelete).not.toHaveBeenCalled();
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("belum dikerjakan dan belum berlangsung -> terhapus dan dicatat audit", async () => {
    const res = await hapus();
    expect(res.status).toBe(200);
    expect(m.attemptCount).toHaveBeenCalledWith({ where: { assignmentId: ID } });
    expect(m.assignmentDelete).toHaveBeenCalledWith({ where: { id: ID } });
    expect(m.logAudit).toHaveBeenCalledWith(expect.objectContaining({ aksi: "delete", entitas: "assignments", entitasId: ID, before: dasar }));
  });

  it("sudah ada yang mengerjakan -> 409 SUDAH_DIKERJAKAN (jumlah disebut), TIDAK dihapus dan tidak ada audit hapus", async () => {
    m.attemptCount.mockResolvedValue(4);
    const res = await hapus();
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("SUDAH_DIKERJAKAN");
    expect(json.error).toContain("4 kali");
    expect(m.assignmentDelete).not.toHaveBeenCalled();
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("sedang berlangsung (aktif dan jendela terbuka) -> 409 MASIH_BERLANGSUNG, bahkan tanpa percobaan", async () => {
    m.assignmentFindUnique.mockResolvedValue({ ...dasar, mulai: new Date("2026-10-07T23:00:00Z"), selesai: new Date("2026-10-08T03:00:00Z") });
    const res = await hapus();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("MASIH_BERLANGSUNG");
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.assignmentDelete).not.toHaveBeenCalled();
  });

  it("sedang dalam jendela tetapi sudah dinonaktifkan -> boleh dihapus bila belum dikerjakan", async () => {
    m.assignmentFindUnique.mockResolvedValue({ ...dasar, mulai: new Date("2026-10-07T23:00:00Z"), selesai: new Date("2026-10-08T03:00:00Z"), isActive: false });
    expect((await hapus()).status).toBe(200);
    expect(m.assignmentDelete).toHaveBeenCalled();
  });

  it("jendela sudah tutup dan belum dikerjakan -> boleh dihapus", async () => {
    m.assignmentFindUnique.mockResolvedValue({ ...dasar, mulai: new Date("2026-10-01T01:00:00Z"), selesai: new Date("2026-10-02T03:00:00Z") });
    expect((await hapus()).status).toBe(200);
  });

  it("jumlah percobaan dihitung DI DALAM transaksi yang sama dengan penghapusan", async () => {
    await hapus();
    expect(m.transaction).toHaveBeenCalledTimes(1);
  });

  it("bukan admin -> 403 dan tidak menyentuh data", async () => {
    m.requireRole.mockRejectedValue(new Error("x"));
    expect((await hapus()).status).toBe(403);
    expect(m.assignmentFindUnique).not.toHaveBeenCalled();
  });
});
