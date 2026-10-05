import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  studentFindFirst: vi.fn(),
  getSelfSelectPackagesFor: vi.fn(),
  getActiveAssignmentsFor: vi.fn(),
  statusSeriMandiri: vi.fn(),
  getRingkasanAksesUjian: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { student: { findFirst: m.studentFindFirst } } }));
vi.mock("@/lib/exam/visibility", () => ({
  getSelfSelectPackagesFor: m.getSelfSelectPackagesFor,
  getActiveAssignmentsFor: m.getActiveAssignmentsFor,
}));
vi.mock("@/lib/exam/seri-mandiri", () => ({ statusSeriMandiri: m.statusSeriMandiri }));
vi.mock("@/lib/billing/akses-ujian", () => ({ getRingkasanAksesUjian: m.getRingkasanAksesUjian }));

import { GET } from "@/app/api/siswa/ujian/akses/route";

const STUDENT = { id: "siswa-1", jalur: "B", schoolId: null };
const MTK = { id: "mat", nama: "Matematika", jenjang: "SMP" };

const PAKET_A = {
  id: "paket-a",
  nama: "PAKET A",
  jumlahSoal: 30,
  durasiMenit: 90,
  kategori: "mandiri",
  subjectId: "mat",
  urutanSeri: 1,
  bukaMulai: null,
  subject: MTK,
};
const PAKET_B = { ...PAKET_A, id: "paket-b", nama: "PAKET B", urutanSeri: 2 };
const PAKET_BIOLOGI = { ...PAKET_A, id: "paket-bio", subjectId: "bio", subject: { id: "bio", nama: "IPA" } };

const RINGKASAN = {
  tipe: "gratis",
  mapel: "Matematika",
  jatahGratis: { terpakai: false },
  learningAnalytics: { harga: 9000, saldo: 0, kuota: null },
};

const req = (qs: string) => new Request(`http://localhost/api/siswa/ujian/akses?${qs}`);

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "user-1", role: "siswa" });
  m.studentFindFirst.mockResolvedValue(STUDENT);
  m.getSelfSelectPackagesFor.mockResolvedValue([PAKET_A, PAKET_B, PAKET_BIOLOGI]);
  m.getActiveAssignmentsFor.mockResolvedValue([]);
  m.statusSeriMandiri.mockResolvedValue({ terkunci: false });
  m.getRingkasanAksesUjian.mockResolvedValue(RINGKASAN);
});

describe("GET /api/siswa/ujian/akses - data ujian + akses dalam satu permintaan", () => {
  it("403 bukan siswa; 404 tanpa profil siswa; 400 kalau parameter tidak tepat satu", async () => {
    m.requireRole.mockRejectedValueOnce(new Error("x"));
    expect((await GET(req("packageId=paket-a"))).status).toBe(403);

    m.studentFindFirst.mockResolvedValueOnce(null);
    expect((await GET(req("packageId=paket-a"))).status).toBe(404);

    expect((await GET(req(""))).status).toBe(400);
    expect((await GET(req("packageId=a&assignmentId=b"))).status).toBe(400);
  });

  it("paket yang tersedia: mengembalikan info ujian + ringkasan akses, tanpa memuat daftar lengkap lagi", async () => {
    const res = await GET(req("packageId=paket-a"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.info).toMatchObject({
      nama: "PAKET A",
      jumlahSoal: 30,
      durasiMenit: 90,
      kategori: "mandiri",
      subject: { id: "mat", nama: "Matematika" },
      urutanSeri: 1,
      statusSeri: { terkunci: false },
    });
    expect(body.tipe).toBe("gratis");
    expect(body.jatahGratis).toEqual({ terpakai: false });
    expect(body.learningAnalytics).toEqual(RINGKASAN.learningAnalytics);
    expect(m.getRingkasanAksesUjian).toHaveBeenCalledWith(STUDENT, { id: "mat", nama: "Matematika" });
  });

  it("paket yang TIDAK ada di daftar siswa (mis. khusus sekolah lain) -> 404, bukan bocor datanya", async () => {
    const res = await GET(req("packageId=paket-tak-terlihat"));
    expect(res.status).toBe(404);
    expect(m.getRingkasanAksesUjian).not.toHaveBeenCalled();
  });

  it("status seri memakai prasyarat dari paket seri yang terlihat di mapel & kategori yang sama saja", async () => {
    m.statusSeriMandiri.mockResolvedValue({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "PAKET A" });
    const res = await GET(req("packageId=paket-b"));
    const body = await res.json();
    expect(body.info.statusSeri).toEqual({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "PAKET A" });

    const [studentId, target, kandidat] = m.statusSeriMandiri.mock.calls[0]!;
    expect(studentId).toBe("siswa-1");
    expect(target).toEqual({ id: "paket-b", subjectId: "mat", urutanSeri: 2, bukaMulai: null });
    expect((kandidat as { id: string }[]).map((p) => p.id).sort()).toEqual(["paket-a", "paket-b"]); // tanpa paket IPA
  });

  it("paket Nasional dilaporkan tanpa urutan seri (hanya Try Out Mandiri yang berseri)", async () => {
    m.getSelfSelectPackagesFor.mockResolvedValue([{ ...PAKET_A, id: "paket-nas", kategori: "nasional", urutanSeri: 3 }]);
    const body = await (await GET(req("packageId=paket-nas"))).json();
    expect(body.info.urutanSeri).toBeNull();
  });

  it("memuat paket dengan includeUpcoming (paket yang belum dibuka tetap tampil, seperti di daftar ujian)", async () => {
    await GET(req("packageId=paket-a"));
    expect(m.getSelfSelectPackagesFor).toHaveBeenCalledWith(STUDENT, { includeUpcoming: true });
  });

  it("penugasan aktif sekolah: info dari paket penugasan, ditandai tidak terkunci", async () => {
    m.getActiveAssignmentsFor.mockResolvedValue([
      {
        id: "asg-1",
        selesai: new Date("2026-10-10T00:00:00Z"),
        package: { nama: "UTS Matematika", jumlahSoal: 20, durasiMenit: 60, subject: { id: "mat", nama: "Matematika" } },
      },
    ]);
    const res = await GET(req("assignmentId=asg-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.info).toMatchObject({
      nama: "UTS Matematika",
      jumlahSoal: 20,
      durasiMenit: 60,
      kategori: "mandiri",
      subject: { id: "mat", nama: "Matematika" },
      statusSeri: { terkunci: false },
    });
    expect(m.getSelfSelectPackagesFor).not.toHaveBeenCalled();
  });

  it("penugasan yang tidak aktif/bukan milik sekolahnya -> 404", async () => {
    expect((await GET(req("assignmentId=asg-lain"))).status).toBe(404);
  });
});
