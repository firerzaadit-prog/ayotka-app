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
import { GET as analitikPusatGET } from "@/app/api/admin-pusat/analitik/route";

const MALANG = "Kota Malang";
const JATIM = "Jawa Timur";
/** Dinas kota/kabupaten: satu kota. Dinas provinsi: seluruh kota/kabupaten di provinsinya. */
const DINAS_MALANG = { provinsi: JATIM, kabupatenKota: MALANG };
const DINAS_JATIM = { provinsi: JATIM, kabupatenKota: null };

type Sekolah = { provinsi?: string | null; kabupatenKota: string | null };

describe("siswaDalamWilayahDinas", () => {
  const siswa = (ekstra: Partial<{ jalur: string; deletedAt: Date | null; school: Sekolah | null }> = {}) => ({
    jalur: "A",
    deletedAt: null,
    school: { provinsi: JATIM, kabupatenKota: MALANG } as Sekolah | null,
    ...ekstra,
  });

  it("siswa Jalur A, belum dihapus, sekolahnya di wilayah dinas: boleh", () => {
    expect(siswaDalamWilayahDinas(siswa(), DINAS_MALANG)).toBe(true);
  });

  it("sekolah di wilayah lain: tidak boleh (ID siswa tidak bisa dipakai mengintip kota lain)", () => {
    expect(siswaDalamWilayahDinas(siswa({ school: { provinsi: JATIM, kabupatenKota: "Kota Surabaya" } }), DINAS_MALANG)).toBe(false);
  });

  it("siswa mandiri (Jalur B) walau sekolah asalnya di wilayah itu: tidak boleh", () => {
    expect(siswaDalamWilayahDinas(siswa({ jalur: "B" }), DINAS_MALANG)).toBe(false);
    expect(siswaDalamWilayahDinas(siswa({ jalur: "B" }), DINAS_JATIM)).toBe(false);
  });

  it("siswa yang sudah dihapus/diarsipkan: tidak boleh", () => {
    expect(siswaDalamWilayahDinas(siswa({ deletedAt: new Date() }), DINAS_MALANG)).toBe(false);
  });

  it("tanpa sekolah, atau sekolah yang kota/kabupatennya belum diisi: tidak boleh", () => {
    expect(siswaDalamWilayahDinas(siswa({ school: null }), DINAS_MALANG)).toBe(false);
    expect(siswaDalamWilayahDinas(siswa({ school: { provinsi: null, kabupatenKota: null } }), DINAS_MALANG)).toBe(false);
  });

  it("wilayah dinas kosong: tidak boleh melihat siapa pun (gagal tertutup, bukan 'semua wilayah')", () => {
    expect(siswaDalamWilayahDinas(siswa(), null)).toBe(false);
    expect(siswaDalamWilayahDinas(siswa({ school: { kabupatenKota: null } }), null)).toBe(false);
    expect(siswaDalamWilayahDinas(siswa(), { provinsi: null, kabupatenKota: null })).toBe(false);
  });

  it("alumni (sudah lulus tapi belum dihapus) tetap boleh dilihat - riwayat angkatan lalu", () => {
    expect(siswaDalamWilayahDinas({ ...siswa(), lulusAt: new Date() } as never, DINAS_MALANG)).toBe(true);
  });

  describe("dinas provinsi", () => {
    it("melihat siswa di SEMUA kota/kabupaten provinsinya, tidak di provinsi lain", () => {
      expect(siswaDalamWilayahDinas(siswa(), DINAS_JATIM)).toBe(true);
      expect(siswaDalamWilayahDinas(siswa({ school: { provinsi: JATIM, kabupatenKota: "Kabupaten Banyuwangi" } }), DINAS_JATIM)).toBe(true);
      expect(siswaDalamWilayahDinas(siswa({ school: { provinsi: "Jawa Barat", kabupatenKota: "Kota Bandung" } }), DINAS_JATIM)).toBe(false);
    });

    it("sekolah yang kolom provinsinya belum terisi tetap dikenali lewat kota/kabupatennya", () => {
      expect(siswaDalamWilayahDinas(siswa({ school: { provinsi: null, kabupatenKota: "Kota Surabaya" } }), DINAS_JATIM)).toBe(true);
      expect(siswaDalamWilayahDinas(siswa({ school: { kabupatenKota: "Kota Bandung" } }), DINAS_JATIM)).toBe(false);
    });

    it("sekolah yang hanya punya provinsi (kota/kabupaten belum diisi) ikut dinas provinsi, tidak ikut dinas kota", () => {
      const sekolah = { provinsi: JATIM, kabupatenKota: null };
      expect(siswaDalamWilayahDinas(siswa({ school: sekolah }), DINAS_JATIM)).toBe(true);
      expect(siswaDalamWilayahDinas(siswa({ school: sekolah }), DINAS_MALANG)).toBe(false);
    });
  });
});

describe("bacaCakupanDinas", () => {
  beforeEach(() => vi.resetAllMocks());

  it("admin pusat: tidak dibatasi dan tidak membuka database", async () => {
    expect(await bacaCakupanDinas({ id: "u1", role: "admin_pusat" })).toEqual({ provinsi: null, kabupatenKota: null });
    expect(m.dinasFindUnique).not.toHaveBeenCalled();
  });

  it("dinas kota/kabupaten: dibatasi ke kota/kabupatennya (provinsi ikut)", async () => {
    m.dinasFindUnique.mockResolvedValue({ provinsi: JATIM, kabupatenKota: MALANG });
    expect(await bacaCakupanDinas({ id: "u2", role: "dinas_pendidikan" })).toEqual(DINAS_MALANG);
  });

  it("akun lama tanpa kolom provinsi: provinsi diturunkan dari kota/kabupaten", async () => {
    m.dinasFindUnique.mockResolvedValue({ provinsi: null, kabupatenKota: MALANG });
    expect(await bacaCakupanDinas({ id: "u2", role: "dinas_pendidikan" })).toEqual(DINAS_MALANG);
  });

  it("dinas provinsi: dibatasi ke provinsinya (semua kota/kabupaten di dalamnya)", async () => {
    m.dinasFindUnique.mockResolvedValue({ provinsi: JATIM, kabupatenKota: null });
    expect(await bacaCakupanDinas({ id: "u4", role: "dinas_pendidikan" })).toEqual(DINAS_JATIM);
  });

  it.each([
    ["tanpa profil", null],
    ["wilayah kosong", { provinsi: null, kabupatenKota: null }],
    ["wilayah string kosong", { provinsi: "", kabupatenKota: "" }],
    ["wilayah spasi", { provinsi: "  ", kabupatenKota: " " }],
  ])("dinas %s: ditolak 403 (gagal tertutup), bukan dianggap semua wilayah", async (_nama, profil) => {
    m.dinasFindUnique.mockResolvedValue(profil);
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
    ["analitik", (qs?: string) => analitikGET(req(qs))],
    ["kesiapan", (qs?: string) => kesiapanGET(req(qs))],
    ["kesiapan/siswa", (qs?: string) => kesiapanSiswaGET(req(qs ?? "mapel=Matematika"))],
    ["schools", (qs?: string) => schoolsGET(req(qs))],
  ] as const;
  const dinasLogin = (profil: unknown) => {
    m.requireRole.mockResolvedValue({ id: "dinas-1", role: "dinas_pendidikan" });
    m.dinasFindUnique.mockResolvedValue(profil);
  };
  const tidakAdaDataDimuat = () => {
    expect(m.buildAnalitikGlobal).not.toHaveBeenCalled();
    expect(m.buildKesiapanAntarSekolah).not.toHaveBeenCalled();
    expect(m.buildDaftarSiswa).not.toHaveBeenCalled();
    expect(m.schoolFindMany).not.toHaveBeenCalled();
  };

  it.each(semuaRute)("%s: akun dinas tanpa wilayah ditolak 403 dan tidak ada data yang dimuat", async (_nama, panggil) => {
    dinasLogin(null);
    const res = await panggil();
    expect(res.status).toBe(403);
    tidakAdaDataDimuat();
  });

  it("analitik: wilayah dinas kota diteruskan ke filter agregasi (provinsi ikut terkunci)", async () => {
    dinasLogin({ provinsi: JATIM, kabupatenKota: MALANG });
    expect((await analitikGET(req())).status).toBe(200);
    expect(m.buildAnalitikGlobal.mock.calls[0]![0]).toMatchObject({ provinsi: JATIM, kabupatenKota: MALANG, statusSekolah: null });
    expect(m.buildStatistikMataPelajaran.mock.calls[0]![0]).toMatchObject({ provinsi: JATIM, kabupatenKota: MALANG });
  });

  it("kesiapan dan kesiapan/siswa: wilayah dinas diteruskan", async () => {
    dinasLogin({ provinsi: JATIM, kabupatenKota: MALANG });
    await kesiapanGET(req());
    expect(m.buildKesiapanAntarSekolah.mock.calls[0]![0]).toMatchObject({ provinsi: JATIM, kabupatenKota: MALANG });
    await kesiapanSiswaGET(req("mapel=Matematika"));
    expect(m.buildDaftarSiswa.mock.calls[0]![0]).toMatchObject({ provinsi: JATIM, kabupatenKota: MALANG });
  });

  it("schools: hanya sekolah di kota dinas yang dicari", async () => {
    dinasLogin({ provinsi: JATIM, kabupatenKota: MALANG });
    await schoolsGET(req());
    expect(m.schoolFindMany.mock.calls[0]![0].where).toMatchObject({ status: "aktif", kabupatenKota: MALANG });
  });

  it("admin pusat tetap melihat semua wilayah (tanpa filter) dan tidak butuh profil dinas", async () => {
    m.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
    expect((await analitikGET(req())).status).toBe(200);
    expect(m.buildAnalitikGlobal.mock.calls[0]![0]).toMatchObject({ provinsi: null, kabupatenKota: null, statusSekolah: null });
    await schoolsGET(req());
    const where = m.schoolFindMany.mock.calls[0]![0].where;
    expect(where).not.toHaveProperty("kabupatenKota");
    expect(where).not.toHaveProperty("OR");
    expect(m.dinasFindUnique).not.toHaveBeenCalled();
  });

  it.each(semuaRute)("%s: peran selain admin pusat dan dinas ditolak 403", async (_nama, panggil) => {
    m.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await panggil()).status).toBe(403);
  });

  describe("dinas provinsi", () => {
    it("analitik: dibatasi ke provinsinya, semua kota/kabupaten", async () => {
      dinasLogin(DINAS_JATIM);
      expect((await analitikGET(req())).status).toBe(200);
      expect(m.buildAnalitikGlobal.mock.calls[0]![0]).toMatchObject({ provinsi: JATIM, kabupatenKota: null });
    });

    it("boleh mempersempit ke satu kota/kabupaten DI provinsinya", async () => {
      dinasLogin(DINAS_JATIM);
      expect((await analitikGET(req("kabupatenKota=Kota%20Malang"))).status).toBe(200);
      expect(m.buildAnalitikGlobal.mock.calls[0]![0]).toMatchObject({ provinsi: JATIM, kabupatenKota: MALANG });
    });

    it.each(semuaRute)("%s: kota/kabupaten di provinsi LAIN ditolak 403 dan tidak ada data yang dimuat", async (_nama, panggil) => {
      dinasLogin(DINAS_JATIM);
      const res = await panggil("mapel=Matematika&kabupatenKota=Kota%20Bandung");
      expect(res.status).toBe(403);
      tidakAdaDataDimuat();
    });

    it.each(semuaRute)("%s: provinsi lain ditolak 403", async (_nama, panggil) => {
      dinasLogin(DINAS_JATIM);
      expect((await panggil("mapel=Matematika&provinsi=Jawa%20Barat")).status).toBe(403);
      tidakAdaDataDimuat();
    });

    it("schools: sekolah se-provinsi dicari, termasuk yang kolom provinsinya masih kosong tetapi kotanya di provinsi itu", async () => {
      dinasLogin(DINAS_JATIM);
      await schoolsGET(req());
      const where = m.schoolFindMany.mock.calls[0]![0].where;
      expect(where.status).toBe("aktif");
      expect(where.OR[0]).toEqual({ provinsi: JATIM });
      expect(where.OR[1].kabupatenKota.in).toEqual(expect.arrayContaining([MALANG, "Kabupaten Banyuwangi"]));
      expect(where.OR[1].kabupatenKota.in).not.toContain("Kota Bandung");
      expect(where).not.toHaveProperty("kabupatenKota");
    });
  });

  describe("dinas kota/kabupaten tidak bisa keluar dari wilayahnya", () => {
    it.each(semuaRute)("%s: kota/kabupaten lain ditolak 403", async (_nama, panggil) => {
      dinasLogin(DINAS_MALANG);
      expect((await panggil("mapel=Matematika&kabupatenKota=Kota%20Surabaya")).status).toBe(403);
      tidakAdaDataDimuat();
    });

    it("memilih kota/kabupaten dan provinsinya sendiri tidak mengubah apa pun", async () => {
      dinasLogin(DINAS_MALANG);
      expect((await analitikGET(req("provinsi=Jawa%20Timur&kabupatenKota=Kota%20Malang"))).status).toBe(200);
      expect(m.buildAnalitikGlobal.mock.calls[0]![0]).toMatchObject({ provinsi: JATIM, kabupatenKota: MALANG });
    });
  });

  describe("filter status sekolah (negeri/swasta)", () => {
    it.each(["negeri", "swasta"])("status %s diteruskan ke semua agregasi", async (status) => {
      dinasLogin(DINAS_JATIM);
      await analitikGET(req(`statusSekolah=${status}`));
      expect(m.buildAnalitikGlobal.mock.calls[0]![0]).toMatchObject({ statusSekolah: status });
      await kesiapanGET(req(`statusSekolah=${status}`));
      expect(m.buildKesiapanAntarSekolah.mock.calls[0]![0]).toMatchObject({ statusSekolah: status });
      await schoolsGET(req(`statusSekolah=${status}`));
      expect(m.schoolFindMany.mock.calls[0]![0].where).toMatchObject({ statusSekolah: status });
    });

    it("kosong atau 'semua' = tanpa penyaringan status", async () => {
      dinasLogin(DINAS_JATIM);
      await analitikGET(req("statusSekolah=semua"));
      await analitikGET(req("statusSekolah="));
      expect(m.buildAnalitikGlobal.mock.calls[0]![0].statusSekolah).toBeNull();
      expect(m.buildAnalitikGlobal.mock.calls[1]![0].statusSekolah).toBeNull();
    });

    it.each(semuaRute)("%s: nilai selain negeri/swasta ditolak 400", async (_nama, panggil) => {
      dinasLogin(DINAS_JATIM);
      expect((await panggil("mapel=Matematika&statusSekolah=pemerintah")).status).toBe(400);
      tidakAdaDataDimuat();
    });
  });

  it("pasangan wilayah yang tidak cocok (kota bukan bagian provinsi yang dipilih) ditolak 400 untuk admin pusat", async () => {
    m.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
    const res = await analitikGET(req("provinsi=Jawa%20Barat&kabupatenKota=Kota%20Malang"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/berada di Provinsi Jawa Timur/);
    expect(m.buildAnalitikGlobal).not.toHaveBeenCalled();
  });
});

describe("analitik admin pusat - pemetaan per wilayah dan status sekolah", () => {
  const req = (qs = "") => new Request(`http://localhost/api/admin-pusat/analitik?${qs}`);

  beforeEach(() => {
    vi.resetAllMocks();
    m.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
    m.buildAnalitikGlobal.mockResolvedValue({ jumlahAttempt: 0, perSekolah: [], kompetensi: [], tren: [] });
    m.buildStatistikMataPelajaran.mockResolvedValue([]);
  });

  it("tanpa parameter: tanpa penyaringan wilayah/status (perilaku lama)", async () => {
    expect((await analitikPusatGET(req())).status).toBe(200);
    expect(m.buildAnalitikGlobal.mock.calls[0]![0]).toMatchObject({ provinsi: null, kabupatenKota: null, statusSekolah: null });
  });

  it("provinsi, kota/kabupaten, dan status diteruskan ke agregasi dan statistik mapel", async () => {
    expect((await analitikPusatGET(req("provinsi=Bali&kabupatenKota=Kota%20Denpasar&statusSekolah=swasta"))).status).toBe(200);
    const filter = { provinsi: "Bali", kabupatenKota: "Kota Denpasar", statusSekolah: "swasta" };
    expect(m.buildAnalitikGlobal.mock.calls[0]![0]).toMatchObject(filter);
    expect(m.buildStatistikMataPelajaran.mock.calls[0]![0]).toMatchObject(filter);
  });

  it("hanya kota/kabupaten: provinsi dilengkapi", async () => {
    await analitikPusatGET(req("kabupatenKota=Kota%20Bandung"));
    expect(m.buildAnalitikGlobal.mock.calls[0]![0]).toMatchObject({ provinsi: "Jawa Barat", kabupatenKota: "Kota Bandung" });
  });

  it("pasangan tidak cocok atau status tidak valid: 400 dan tidak ada agregasi", async () => {
    expect((await analitikPusatGET(req("provinsi=Bali&kabupatenKota=Kota%20Malang"))).status).toBe(400);
    expect((await analitikPusatGET(req("statusSekolah=yayasan"))).status).toBe(400);
    expect(m.buildAnalitikGlobal).not.toHaveBeenCalled();
  });

  it("bukan admin pusat (dinas pun tidak) : 403", async () => {
    m.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await analitikPusatGET(req())).status).toBe(403);
  });
});
