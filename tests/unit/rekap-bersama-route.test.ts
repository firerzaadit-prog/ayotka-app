import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  resolveSchoolId: vi.fn(),
  assignmentFindUnique: vi.fn(),
  studentFindMany: vi.fn(),
  attemptFindMany: vi.fn(),
  tutupPercobaanKedaluwarsa: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/schools/scope", () => ({ resolveSchoolId: m.resolveSchoolId }));
vi.mock("@/lib/exam/tutup-kedaluwarsa", () => ({ tutupPercobaanKedaluwarsa: m.tutupPercobaanKedaluwarsa }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    assignment: { findUnique: m.assignmentFindUnique },
    student: { findMany: m.studentFindMany },
    attempt: { findMany: m.attemptFindMany },
  },
}));

import { muatRekapPenugasan } from "@/lib/exam/rekap-bersama-data";
import { GET as GET_REKAP } from "@/app/api/admin-sekolah/assignments/[id]/rekap/route";
import { GET as GET_EXPORT } from "@/app/api/admin-sekolah/assignments/[id]/rekap/export/route";

const SEKOLAH = "sekolah-1";
const ID = "9b1f0c52-9f0c-4c27-9d57-2f7f0d3f6a11";
const params = { params: Promise.resolve({ id: ID }) };

const PENUGASAN = {
  id: ID,
  schoolId: SEKOLAH,
  mulai: new Date("2026-10-08T01:00:00Z"),
  selesai: new Date("2026-10-08T03:00:00Z"),
  isActive: true,
  package: { nama: "Try Out Matematika 1", subject: { nama: "Matematika" } },
  school: { nama: "SMP Negeri Uji" },
};
const SISWA = [
  { id: "s1", nama: "Dina", nisn: "0011", claimStatus: "sudah_klaim" },
  { id: "s2", nama: "Eko", nisn: "0012", claimStatus: "sudah_klaim" },
  { id: "s3", nama: "Fajar", nisn: null, claimStatus: "belum_klaim" },
];
const ATTEMPTS = [
  { id: "a1", studentId: "s1", status: "selesai", skorAkhir: 80, mulaiAt: new Date("2026-10-08T01:05:00Z"), selesaiAt: new Date("2026-10-08T01:35:00Z"), tabSwitchCount: 1 },
  { id: "a2", studentId: "s2", status: "berjalan", skorAkhir: null, mulaiAt: new Date("2026-10-08T01:10:00Z"), selesaiAt: null, tabSwitchCount: 0 },
];

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "user-1", role: "admin_sekolah" });
  m.resolveSchoolId.mockResolvedValue(SEKOLAH);
  m.assignmentFindUnique.mockResolvedValue(PENUGASAN);
  m.studentFindMany.mockResolvedValue(SISWA);
  m.attemptFindMany.mockResolvedValue(ATTEMPTS);
  m.tutupPercobaanKedaluwarsa.mockResolvedValue({ diperiksa: 0, ditutup: [], gagal: [] });
});

describe("muatRekapPenugasan", () => {
  it("penugasan tidak ada atau milik sekolah lain -> null tanpa membaca siswa/percobaan", async () => {
    m.assignmentFindUnique.mockResolvedValue(null);
    expect(await muatRekapPenugasan(SEKOLAH, ID)).toBeNull();
    m.assignmentFindUnique.mockResolvedValue({ ...PENUGASAN, schoolId: "sekolah-lain" });
    expect(await muatRekapPenugasan(SEKOLAH, ID)).toBeNull();
    expect(m.studentFindMany).not.toHaveBeenCalled();
    expect(m.attemptFindMany).not.toHaveBeenCalled();
    expect(m.tutupPercobaanKedaluwarsa).not.toHaveBeenCalled();
  });

  it("menutup percobaan yang waktunya habis lebih dulu (khusus penugasan ini)", async () => {
    await muatRekapPenugasan(SEKOLAH, ID);
    expect(m.tutupPercobaanKedaluwarsa).toHaveBeenCalledWith({ assignmentId: ID });
  });

  it("gagal menutup percobaan kedaluwarsa tidak menggagalkan rekap", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    m.tutupPercobaanKedaluwarsa.mockRejectedValue(new Error("db"));
    const hasil = await muatRekapPenugasan(SEKOLAH, ID);
    expect(hasil?.statistik.jumlahPeserta).toBe(3);
    spy.mockRestore();
  });

  it("peserta = siswa Jalur A sekolah ini yang belum dihapus dan belum lulus, ATAU alumni yang punya percobaan di penugasan ini", async () => {
    await muatRekapPenugasan(SEKOLAH, ID);
    expect(m.studentFindMany.mock.calls[0]![0].where).toEqual({
      schoolId: SEKOLAH,
      jalur: "A",
      deletedAt: null,
      OR: [{ lulusAt: null }, { attempts: { some: { assignmentId: ID } } }],
    });
  });

  it("percobaan hanya dari penugasan ini dan siswa Jalur A sekolah ini yang belum dihapus", async () => {
    await muatRekapPenugasan(SEKOLAH, ID);
    expect(m.attemptFindMany.mock.calls[0]![0].where).toEqual({
      assignmentId: ID,
      student: { schoolId: SEKOLAH, jalur: "A", deletedAt: null },
    });
  });

  it("menyusun rekap dan info penugasan", async () => {
    const hasil = (await muatRekapPenugasan(SEKOLAH, ID))!;
    expect(hasil.penugasan).toEqual({
      id: ID,
      paketNama: "Try Out Matematika 1",
      mapel: "Matematika",
      sekolahNama: "SMP Negeri Uji",
      mulai: PENUGASAN.mulai,
      selesai: PENUGASAN.selesai,
      isActive: true,
    });
    expect(hasil.baris.map((b) => [b.nama, b.status, b.peringkat])).toEqual([
      ["Dina", "selesai", 1],
      ["Eko", "mengerjakan", null],
      ["Fajar", "belum", null],
    ]);
    expect(hasil.statistik).toMatchObject({ jumlahPeserta: 3, jumlahSelesai: 1, jumlahSedang: 1, jumlahBelum: 1, rataRata: 80 });
  });
});

describe("GET /api/admin-sekolah/assignments/[id]/rekap", () => {
  it("bukan admin -> 403", async () => {
    m.requireRole.mockRejectedValue(new Error("x"));
    expect((await GET_REKAP(new Request("http://x"), params)).status).toBe(403);
  });

  it("akun tanpa sekolah -> 403", async () => {
    m.resolveSchoolId.mockResolvedValue(null);
    expect((await GET_REKAP(new Request("http://x"), params)).status).toBe(403);
  });

  it("penugasan sekolah lain -> 404", async () => {
    m.assignmentFindUnique.mockResolvedValue({ ...PENUGASAN, schoolId: "sekolah-lain" });
    expect((await GET_REKAP(new Request("http://x"), params)).status).toBe(404);
  });

  it("berhasil: memuat jam server dan tidak disimpan di cache", async () => {
    const res = await GET_REKAP(new Request("http://x"), params);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const json = await res.json();
    expect(typeof json.sekarang).toBe("string");
    expect(json.baris).toHaveLength(3);
    expect(json.statistik.jumlahPeserta).toBe(3);
  });

  it("memakai sekolah dari SESI (bukan dari permintaan)", async () => {
    await GET_REKAP(new Request("http://x?schoolId=sekolah-lain"), params);
    expect(m.resolveSchoolId).toHaveBeenCalledWith(expect.objectContaining({ id: "user-1" }), null);
  });
});

describe("GET /api/admin-sekolah/assignments/[id]/rekap/export", () => {
  it("bukan admin -> 403; penugasan sekolah lain -> 404", async () => {
    m.requireRole.mockRejectedValue(new Error("x"));
    expect((await GET_EXPORT(new Request("http://x"), params)).status).toBe(403);
    m.requireRole.mockResolvedValue({ id: "user-1", role: "admin_sekolah" });
    m.assignmentFindUnique.mockResolvedValue({ ...PENUGASAN, schoolId: "sekolah-lain" });
    expect((await GET_EXPORT(new Request("http://x"), params)).status).toBe(404);
  });

  it("mengunduh berkas Excel yang sah dengan nama berkas aman dan tanpa cache", async () => {
    const res = await GET_EXPORT(new Request("http://x"), params);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="rekap-try-out-bersama-try-out-matematika-1-\d{4}-\d{2}-\d{2}\.xlsx"$/);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await res.arrayBuffer()) as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Ringkasan", "Hasil Siswa", "Semua Percobaan", "Belum Mengerjakan"]);
    const hasil = wb.getWorksheet("Hasil Siswa")!;
    expect((hasil.getRow(2).values as unknown[]).slice(1, 3)).toEqual([1, "Dina"]);
    const belum = wb.getWorksheet("Belum Mengerjakan")!;
    expect((belum.getRow(2).values as unknown[]).slice(1)).toEqual(["Fajar", "-", "Belum diaktifkan"]);
  });
});
