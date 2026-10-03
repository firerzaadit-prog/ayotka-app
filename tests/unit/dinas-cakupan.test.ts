import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  dinasFindUnique: vi.fn(),
  schoolFindMany: vi.fn(),
  buildAnalitikGlobal: vi.fn(),
  buildStatistikMataPelajaran: vi.fn(),
  buildKesiapanAntarSekolah: vi.fn(),
  buildDaftarSiswa: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { dinasAdmin: { findUnique: m.dinasFindUnique }, school: { findMany: m.schoolFindMany } },
}));
vi.mock("@/lib/analytics/global", () => ({
  buildAnalitikGlobal: m.buildAnalitikGlobal,
  buildStatistikMataPelajaran: m.buildStatistikMataPelajaran,
  buildKesiapanAntarSekolah: m.buildKesiapanAntarSekolah,
  buildDaftarSiswaKesiapanAntarSekolah: m.buildDaftarSiswa,
}));

import { bacaCakupanDinas, siswaDalamWilayahDinas } from "@/lib/dinas/wilayah";
import { GET as analitikGET } from "@/app/api/dinas-pendidikan/analitik/route";
import { GET as kesiapanGET } from "@/app/api/dinas-pendidikan/kesiapan/route";
import { GET as kesiapanSiswaGET } from "@/app/api/dinas-pendidikan/kesiapan/siswa/route";
import { GET as schoolsGET } from "@/app/api/dinas-pendidikan/schools/route";

const MALANG = "Kota Malang";

describe("siswaDalamWilayahDinas", () => {
  const siswa = (ekstra: Partial<{ jalur: string; deletedAt: Date | null; school: { kabupatenKota: string | null } | null }> = {}) => ({
    jalur: "A",
    deletedAt: null,
    school: { kabupatenKota: MALANG },
    ...ekstra,
  });

  it("siswa Jalur A, belum dihapus, sekolahnya di wilayah dinas: boleh", () => {
    expect(siswaDalamWilayahDinas(siswa(), MALANG)).toBe(true);
  });

  it("sekolah di wilayah lain: tidak boleh (ID siswa tidak bisa dipakai mengintip kota lain)", () => {
    expect(siswaDalamWilayahDinas(siswa({ school: { kabupatenKota: "Kota Surabaya" } }), MALANG)).toBe(false);
  });

  it("siswa mandiri (Jalur B) walau sekolah asalnya di wilayah itu: tidak boleh", () => {
    expect(siswaDalamWilayahDinas(siswa({ jalur: "B" }), MALANG)).toBe(false);
  });

  it("siswa yang sudah dihapus/diarsipkan: tidak boleh", () => {
    expect(siswaDalamWilayahDinas(siswa({ deletedAt: new Date() }), MALANG)).toBe(false);
  });

  it("tanpa sekolah, atau sekolah yang kota/kabupatennya belum diisi: tidak boleh", () => {
    expect(siswaDalamWilayahDinas(siswa({ school: null }), MALANG)).toBe(false);
    expect(siswaDalamWilayahDinas(siswa({ school: { kabupatenKota: null } }), MALANG)).toBe(false);
  });

  it("wilayah dinas kosong: tidak boleh melihat siapa pun (gagal tertutup, bukan 'semua wilayah')", () => {
    expect(siswaDalamWilayahDinas(siswa(), null)).toBe(false);
    expect(siswaDalamWilayahDinas(siswa({ school: { kabupatenKota: null } }), null)).toBe(false);
  });

  it("alumni (sudah lulus tapi belum dihapus) tetap boleh dilihat - riwayat angkatan lalu", () => {
    expect(siswaDalamWilayahDinas({ ...siswa(), lulusAt: new Date() } as never, MALANG)).toBe(true);
  });
});

describe("bacaCakupanDinas", () => {
  beforeEach(() => vi.resetAllMocks());

  it("admin pusat: tidak dibatasi dan tidak membuka database", async () => {
    expect(await bacaCakupanDinas({ id: "u1", role: "admin_pusat" })).toEqual({ kabupatenKota: null });
    expect(m.dinasFindUnique).not.toHaveBeenCalled();
  });

  it("dinas dengan wilayah: dibatasi ke wilayahnya", async () => {
    m.dinasFindUnique.mockResolvedValue({ kabupatenKota: MALANG });
    expect(await bacaCakupanDinas({ id: "u2", role: "dinas_pendidikan" })).toEqual({ kabupatenKota: MALANG });
  });

  it("dinas tanpa profil/wilayah: ditolak 403 (gagal tertutup), bukan dianggap semua wilayah", async () => {
    m.dinasFindUnique.mockResolvedValue(null);
    const hasil = await bacaCakupanDinas({ id: "u3", role: "dinas_pendidikan" });
    expect("galat" in hasil).toBe(true);
    if ("galat" in hasil) {
      expect(hasil.galat.status).toBe(403);
      expect((await hasil.galat.json()).error).toMatch(/Wilayah akun dinas belum diatur/);
    }
  });
});

describe("rute dinas pendidikan - cakupan wilayah", () => {
  const req = (qs = "mapel=Matematika") => new Request(`http://localhost/x?${qs}`);

  beforeEach(() => {
    vi.resetAllMocks();
    m.buildAnalitikGlobal.mockResolvedValue({ jumlahAttempt: 0, perSekolah: [], kompetensi: [], tren: [] });
    m.buildStatistikMataPelajaran.mockResolvedValue([]);
    m.buildKesiapanAntarSekolah.mockResolvedValue([]);
    m.buildDaftarSiswa.mockResolvedValue([]);
    m.schoolFindMany.mockResolvedValue([]);
  });

  const semuaRute = [
    ["analitik", () => analitikGET(req())],
    ["kesiapan", () => kesiapanGET(req())],
    ["kesiapan/siswa", () => kesiapanSiswaGET(req("mapel=Matematika"))],
    ["schools", () => schoolsGET()],
  ] as const;

  it.each(semuaRute)("%s: akun dinas tanpa wilayah ditolak 403 dan tidak ada data yang dimuat", async (_nama, panggil) => {
    m.requireRole.mockResolvedValue({ id: "dinas-1", role: "dinas_pendidikan" });
    m.dinasFindUnique.mockResolvedValue(null);
    const res = await panggil();
    expect(res.status).toBe(403);
    expect(m.buildAnalitikGlobal).not.toHaveBeenCalled();
    expect(m.buildKesiapanAntarSekolah).not.toHaveBeenCalled();
    expect(m.buildDaftarSiswa).not.toHaveBeenCalled();
    expect(m.schoolFindMany).not.toHaveBeenCalled();
  });

  it("analitik: wilayah dinas diteruskan ke filter agregasi", async () => {
    m.requireRole.mockResolvedValue({ id: "dinas-1", role: "dinas_pendidikan" });
    m.dinasFindUnique.mockResolvedValue({ kabupatenKota: MALANG });
    expect((await analitikGET(req())).status).toBe(200);
    expect(m.buildAnalitikGlobal.mock.calls[0]![0]).toMatchObject({ kabupatenKota: MALANG });
    expect(m.buildStatistikMataPelajaran.mock.calls[0]![0]).toMatchObject({ kabupatenKota: MALANG });
  });

  it("kesiapan dan kesiapan/siswa: wilayah dinas diteruskan", async () => {
    m.requireRole.mockResolvedValue({ id: "dinas-1", role: "dinas_pendidikan" });
    m.dinasFindUnique.mockResolvedValue({ kabupatenKota: MALANG });
    await kesiapanGET(req());
    expect(m.buildKesiapanAntarSekolah.mock.calls[0]![0]).toMatchObject({ kabupatenKota: MALANG });
    await kesiapanSiswaGET(req("mapel=Matematika"));
    expect(m.buildDaftarSiswa.mock.calls[0]![0]).toMatchObject({ kabupatenKota: MALANG });
  });

  it("schools: hanya sekolah di wilayah dinas yang dicari", async () => {
    m.requireRole.mockResolvedValue({ id: "dinas-1", role: "dinas_pendidikan" });
    m.dinasFindUnique.mockResolvedValue({ kabupatenKota: MALANG });
    await schoolsGET();
    expect(m.schoolFindMany.mock.calls[0]![0].where).toMatchObject({ status: "aktif", kabupatenKota: MALANG });
  });

  it("admin pusat tetap melihat semua wilayah (tanpa filter) dan tidak butuh profil dinas", async () => {
    m.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
    expect((await analitikGET(req())).status).toBe(200);
    expect(m.buildAnalitikGlobal.mock.calls[0]![0].kabupatenKota).toBeNull();
    await schoolsGET();
    expect(m.schoolFindMany.mock.calls[0]![0].where).not.toHaveProperty("kabupatenKota");
    expect(m.dinasFindUnique).not.toHaveBeenCalled();
  });

  it.each(semuaRute)("%s: peran selain admin pusat dan dinas ditolak 403", async (_nama, panggil) => {
    m.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await panggil()).status).toBe(403);
  });
});
