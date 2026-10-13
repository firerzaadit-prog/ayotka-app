import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  resolveSchoolId: vi.fn(),
  checkRateLimit: vi.fn(),
  attemptFindMany: vi.fn(),
  studentFindMany: vi.fn(),
  studentGroupBy: vi.fn(),
  packageFindFirst: vi.fn(),
  schoolFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/schools/scope", () => ({ resolveSchoolId: m.resolveSchoolId }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.checkRateLimit }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    attempt: { findMany: m.attemptFindMany },
    student: { findMany: m.studentFindMany, groupBy: m.studentGroupBy },
    package: { findFirst: m.packageFindFirst },
    school: { findUnique: m.schoolFindUnique },
  },
}));

import { bacaFilterLaporan, MAKS_PANJANG_CARI } from "@/lib/hasil-tryout/param";
import { GET as GET_RAPOR } from "@/app/api/admin-sekolah/rapor/route";
import { GET as GET_PERINGKAT } from "@/app/api/admin-sekolah/peringkat/route";
import { GET as GET_PERINGKAT_EXPORT } from "@/app/api/admin-sekolah/peringkat/export/route";
import { GET as GET_PAKET } from "@/app/api/admin-sekolah/paket/route";
import { GET as GET_DETAIL } from "@/app/api/admin-sekolah/paket/[id]/route";
import { GET as GET_DETAIL_EXPORT } from "@/app/api/admin-sekolah/paket/[id]/export/route";

const SEKOLAH = "sekolah-1";
const M1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const M2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const P1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const P2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const PN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3";

type Murid = { id: string; nama: string; nisn: string | null; claimStatus: string; lulusAt: Date | null };
const S1: Murid = { id: "s1", nama: "Ani", nisn: "1001", claimStatus: "sudah_klaim", lulusAt: null };
const S2: Murid = { id: "s2", nama: "Budi", nisn: "1002", claimStatus: "sudah_klaim", lulusAt: null };
const S3: Murid = { id: "s3", nama: "Citra", nisn: "1003", claimStatus: "sudah_klaim", lulusAt: new Date("2026-06-30T00:00:00Z") };
const K1 = { id: P1, nama: "Paket 1", kategori: "mandiri", ownerType: "pusat", jenjang: "SMP", subjectId: M1, subject: { nama: "Matematika" } };
const K2 = { id: P2, nama: "Paket 2", kategori: "mandiri", ownerType: "pusat", jenjang: "SMP", subjectId: M2, subject: { nama: "Bahasa Indonesia" } };
const KN = { id: PN, nama: "Nasional 1", kategori: "nasional", ownerType: "pusat", jenjang: "SMP", subjectId: M1, subject: { nama: "Matematika" } };

const baris = (id: string, student: Murid, paket: typeof K1, o: Record<string, unknown> = {}) => ({
  id,
  studentId: student.id,
  packageId: paket.id,
  assignmentId: null,
  status: "selesai",
  skorAkhir: 80,
  mulaiAt: new Date("2026-10-01T01:00:00Z"),
  selesaiAt: new Date("2026-10-01T01:30:00Z"),
  student,
  package: paket,
  ...o,
});

const PERCOBAAN = [
  baris("a1", S1, K1, { skorAkhir: 90, mulaiAt: new Date("2026-10-01T01:00:00Z") }), // mandiri
  baris("a2", S1, K2, { skorAkhir: 70, assignmentId: "pen-1", mulaiAt: new Date("2026-10-05T01:00:00Z") }), // sekolah
  baris("a3", S2, K1, { skorAkhir: 60, mulaiAt: new Date("2026-10-02T01:00:00Z") }), // mandiri
  baris("a4", S2, KN, { skorAkhir: 85, mulaiAt: new Date("2026-10-10T01:00:00Z") }), // nasional
  baris("a5", S3, K1, { skorAkhir: 50, mulaiAt: new Date("2026-09-01T01:00:00Z") }), // alumni
  baris("a6", S1, K1, { skorAkhir: 100, mulaiAt: new Date("2026-10-20T01:00:00Z") }), // ulang: tidak mengubah nilai resmi
];

const minta = (jalur: string) => new Request(`http://localhost${jalur}`);

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "admin-1", role: "admin_sekolah" });
  m.resolveSchoolId.mockResolvedValue(SEKOLAH);
  m.checkRateLimit.mockReturnValue(true);
  m.attemptFindMany.mockResolvedValue(PERCOBAAN);
  m.studentGroupBy.mockResolvedValue([{ jenjang: "SMP", _count: { _all: 10 } }]);
  m.studentFindMany.mockResolvedValue([S1, S2, { id: "s4", nama: "Dewi", nisn: null, claimStatus: "belum_klaim", lulusAt: null }]);
  m.packageFindFirst.mockResolvedValue({ ...K1, jumlahSoal: 30, durasiMenit: 90 });
  m.schoolFindUnique.mockResolvedValue({ nama: "SMP Negeri Uji" });
});

const semuaRute = [
  ["rapor", () => GET_RAPOR(minta("/api/admin-sekolah/rapor"))],
  ["peringkat", () => GET_PERINGKAT(minta("/api/admin-sekolah/peringkat"))],
  ["peringkat/export", () => GET_PERINGKAT_EXPORT(minta("/api/admin-sekolah/peringkat/export"))],
  ["paket", () => GET_PAKET(minta("/api/admin-sekolah/paket"))],
  ["paket/[id]", () => GET_DETAIL(minta(`/api/admin-sekolah/paket/${P1}`), { params: Promise.resolve({ id: P1 }) })],
  ["paket/[id]/export", () => GET_DETAIL_EXPORT(minta(`/api/admin-sekolah/paket/${P1}/export`), { params: Promise.resolve({ id: P1 }) })],
] as const;

describe("otorisasi dan cakupan sekolah (semua rute laporan)", () => {
  it.each(semuaRute)("%s: bukan admin sekolah/pusat -> 403 tanpa menyentuh database", async (_nama, panggil) => {
    m.requireRole.mockRejectedValue(new Error("tidak berhak"));
    const res = await panggil();
    expect(res.status).toBe(403);
    expect(m.attemptFindMany).not.toHaveBeenCalled();
  });

  it.each(semuaRute)("%s: akun belum terhubung ke sekolah -> 403", async (_nama, panggil) => {
    m.resolveSchoolId.mockResolvedValue(null);
    const res = await panggil();
    expect(res.status).toBe(403);
    expect(m.attemptFindMany).not.toHaveBeenCalled();
  });

  it.each(semuaRute)("%s: terlalu banyak permintaan -> 429", async (_nama, panggil) => {
    m.checkRateLimit.mockReturnValue(false);
    const res = await panggil();
    expect(res.status).toBe(429);
    expect(m.attemptFindMany).not.toHaveBeenCalled();
  });

  it("sekolah SELALU dari sesi: ?schoolId= diabaikan dan resolveSchoolId dipanggil tanpa sekolah permintaan", async () => {
    await GET_RAPOR(minta("/api/admin-sekolah/rapor?schoolId=sekolah-lain"));
    expect(m.resolveSchoolId).toHaveBeenCalledWith(expect.anything(), null);
  });

  it("hanya percobaan SELESAI siswa Jalur A sekolah itu yang dibaca (siswa mandiri dan arsip tidak pernah ikut)", async () => {
    await GET_RAPOR(minta("/api/admin-sekolah/rapor"));
    const where = m.attemptFindMany.mock.calls[0]![0].where;
    expect(where.status).toEqual({ in: ["selesai", "kedaluwarsa"] });
    expect(where.student).toEqual({ schoolId: SEKOLAH, jalur: "A", deletedAt: null });
  });

  it("siswa yang boleh mengerjakan paket (daftar 'belum') hanya Jalur A, sekolah itu, belum dihapus dan belum lulus", async () => {
    await GET_DETAIL(minta(`/api/admin-sekolah/paket/${P1}`), { params: Promise.resolve({ id: P1 }) });
    expect(m.studentFindMany.mock.calls[0]![0].where).toEqual({ schoolId: SEKOLAH, jalur: "A", deletedAt: null, lulusAt: null, jenjang: "SMP" });
    // percobaan yang sedang berjalan juga dibatasi ke siswa sekolah itu
    const sedang = m.attemptFindMany.mock.calls.map((c) => c[0].where).find((w) => Array.isArray(w.status?.in) && w.status.in.includes("berjalan"));
    expect(sedang.student).toEqual({ schoolId: SEKOLAH, jalur: "A", deletedAt: null });
    expect(sedang.packageId).toBe(P1);
  });
});

describe("validasi parameter -> 400 yang jelas", () => {
  const rusak: Array<[string, string]> = [
    ["jenis tidak dikenal", "jenis=umum"],
    ["mapel bukan UUID", "mapel=bukan-uuid"],
    ["paket bukan UUID", "paket=1"],
    ["alumni tidak dikenal", "alumni=mungkin"],
    ["tanggal salah format", "dari=2026-13-45"],
    ["dari setelah sampai", "dari=2026-10-10&sampai=2026-10-01"],
    ["halaman bukan angka", "halaman=abc"],
    ["halaman nol", "halaman=0"],
    ["ukuran di luar pilihan", "ukuran=33"],
    ["urutan tidak dikenal", "urut=acak"],
  ];
  it.each(rusak)("rapor: %s", async (_nama, query) => {
    const res = await GET_RAPOR(minta(`/api/admin-sekolah/rapor?${query}`));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeTruthy();
    expect(m.attemptFindMany).not.toHaveBeenCalled();
  });

  it("peringkat: minimal try out di luar rentang atau bukan angka ditolak", async () => {
    for (const q of ["minimal=0", "minimal=51", "minimal=dua", "minimal=1.5"]) {
      expect((await GET_PERINGKAT(minta(`/api/admin-sekolah/peringkat?${q}`))).status, q).toBe(400);
    }
  });

  it("paket: urutan tidak dikenal ditolak; detail: id paket bukan UUID ditolak", async () => {
    expect((await GET_PAKET(minta("/api/admin-sekolah/paket?urut=acak"))).status).toBe(400);
    expect((await GET_DETAIL(minta("/api/admin-sekolah/paket/xyz"), { params: Promise.resolve({ id: "xyz" }) })).status).toBe(400);
    expect((await GET_DETAIL_EXPORT(minta("/api/admin-sekolah/paket/xyz/export"), { params: Promise.resolve({ id: "xyz" }) })).status).toBe(400);
  });

  it("pencarian dibatasi 100 karakter (tidak ditolak, dipotong)", async () => {
    const res = await GET_RAPOR(minta(`/api/admin-sekolah/rapor?cari=${"a".repeat(300)}`));
    expect(res.status).toBe(200);
    const f = bacaFilterLaporan(new URL(`http://x/?cari=${"a".repeat(300)}`), "ikut");
    expect("filter" in f && f.filter.cari).toBe("a".repeat(MAKS_PANJANG_CARI));
    expect(MAKS_PANJANG_CARI).toBe(100);
    // spasi di ujung dibuang; hanya spasi = tanpa pencarian
    expect("filter" in bacaFilterLaporan(new URL("http://x/?cari=%20%20Ani%20"), "ikut") && (bacaFilterLaporan(new URL("http://x/?cari=%20%20Ani%20"), "ikut") as { filter: { cari: string } }).filter.cari).toBe("Ani");
    expect((bacaFilterLaporan(new URL("http://x/?cari=%20%20"), "ikut") as { filter: { cari: string | null } }).filter.cari).toBeNull();
  });
});

describe("GET /api/admin-sekolah/rapor", () => {
  it("satu baris per siswa per try out dari percobaan PERTAMA; ulang tidak muncul; jenis dan jumlah per jenis benar", async () => {
    const res = await GET_RAPOR(minta("/api/admin-sekolah/rapor?urut=nama"));
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(j.total).toBe(5);
    expect(j.jumlahPerJenis).toEqual({ semua: 5, mandiri: 3, sekolah: 1, nasional: 1 });
    const a1 = j.baris.find((b: { attemptId: string }) => b.attemptId === "a1");
    expect(a1).toMatchObject({ nama: "Ani", paketNama: "Paket 1", mapel: "Matematika", jenis: "mandiri", skor: 90, alumni: false });
    expect(j.baris.map((b: { attemptId: string }) => b.attemptId)).not.toContain("a6");
    // tidak membocorkan bidang internal
    expect(Object.keys(a1).sort()).toEqual(["alumni", "attemptId", "durasiMenit", "jenis", "mapel", "mulaiAt", "nama", "nisn", "paketId", "paketNama", "skor", "status", "studentId"]);
    expect(j.ringkasan).toEqual({ jumlahHasil: 5, jumlahSiswa: 3, rataRata: 71 });
    expect(j.pilihan.mapel.map((x: { nama: string }) => x.nama)).toEqual(["Bahasa Indonesia", "Matematika"]);
  });

  it("filter jenis menyaring baris tetapi jumlahPerJenis tetap menghitung semua jenis", async () => {
    const j = await (await GET_RAPOR(minta("/api/admin-sekolah/rapor?jenis=sekolah"))).json();
    expect(j.baris.map((b: { attemptId: string }) => b.attemptId)).toEqual(["a2"]);
    expect(j.total).toBe(1);
    expect(j.jumlahPerJenis).toEqual({ semua: 5, mandiri: 3, sekolah: 1, nasional: 1 });
  });

  it("tanpa alumni, pencarian, mapel, dan rentang tanggal (WIB)", async () => {
    const tanpaAlumni = await (await GET_RAPOR(minta("/api/admin-sekolah/rapor?alumni=tanpa"))).json();
    expect(tanpaAlumni.total).toBe(4);
    expect(tanpaAlumni.jumlahPerJenis.mandiri).toBe(2);
    const cari = await (await GET_RAPOR(minta("/api/admin-sekolah/rapor?cari=1003"))).json();
    expect(cari.baris.map((b: { nama: string }) => b.nama)).toEqual(["Citra"]);
    const mapel = await (await GET_RAPOR(minta(`/api/admin-sekolah/rapor?mapel=${M2}`))).json();
    expect(mapel.baris.map((b: { attemptId: string }) => b.attemptId)).toEqual(["a2"]);
    // 5 Okt 2026 08.00 WIB = 01.00 UTC: rentang satu hari penuh WIB mencakupnya
    const tgl = await (await GET_RAPOR(minta("/api/admin-sekolah/rapor?dari=2026-10-05&sampai=2026-10-05"))).json();
    expect(tgl.baris.map((b: { attemptId: string }) => b.attemptId)).toEqual(["a2"]);
  });

  it("halaman dan ukuran: potongan benar, halaman berlebih dirapatkan, urutan nilai tertinggi", async () => {
    const h1 = await (await GET_RAPOR(minta("/api/admin-sekolah/rapor?ukuran=10&urut=nilai_tertinggi"))).json();
    expect(h1.baris.map((b: { skor: number }) => b.skor)).toEqual([90, 85, 70, 60, 50]);
    const kecil = await (await GET_RAPOR(minta("/api/admin-sekolah/rapor?ukuran=10&halaman=1"))).json();
    expect(kecil).toMatchObject({ halaman: 1, ukuran: 10, totalHalaman: 1 });
    const jauh = await (await GET_RAPOR(minta("/api/admin-sekolah/rapor?halaman=99"))).json();
    expect(jauh.halaman).toBe(1);
  });

  it("belum ada hasil sama sekali: daftar kosong tanpa galat", async () => {
    m.attemptFindMany.mockResolvedValue([]);
    const j = await (await GET_RAPOR(minta("/api/admin-sekolah/rapor"))).json();
    expect(j).toMatchObject({ baris: [], total: 0, totalHalaman: 1, jumlahPerJenis: { semua: 0, mandiri: 0, sekolah: 0, nasional: 0 }, ringkasan: { jumlahHasil: 0, jumlahSiswa: 0, rataRata: null } });
  });
});

describe("GET /api/admin-sekolah/peringkat", () => {
  it("bawaan: siswa aktif saja (alumni tidak ikut), rata-rata tertinggi dulu, jumlah siswa per jenis", async () => {
    const j = await (await GET_PERINGKAT(minta("/api/admin-sekolah/peringkat"))).json();
    expect(j.baris.map((b: { peringkat: number; nama: string; rataRata: number }) => [b.peringkat, b.nama, b.rataRata])).toEqual([
      [1, "Ani", 80],
      [2, "Budi", 72.5],
    ]);
    expect(j.ringkasan).toEqual({ jumlahSiswa: 2, jumlahTryOut: 4, rataRata: 76.3 });
    expect(j.jumlahSiswaPerJenis).toEqual({ semua: 2, mandiri: 2, sekolah: 1, nasional: 1 });
  });

  it("jumlahSiswaPerJenis tidak ikut berubah oleh pilihan jenis (angka di tiap pilihan tetap bermakna)", async () => {
    const j = await (await GET_PERINGKAT(minta("/api/admin-sekolah/peringkat?jenis=nasional"))).json();
    expect(j.baris).toHaveLength(1);
    expect(j.jumlahSiswaPerJenis).toEqual({ semua: 2, mandiri: 2, sekolah: 1, nasional: 1 });
  });

  it("?alumni=ikut menyertakan alumni; minimal=2 menyaring siswa yang try out-nya sedikit; jenis menyaring", async () => {
    const ikut = await (await GET_PERINGKAT(minta("/api/admin-sekolah/peringkat?alumni=ikut"))).json();
    expect(ikut.baris.map((b: { nama: string }) => b.nama)).toEqual(["Ani", "Budi", "Citra"]);
    const minimal = await (await GET_PERINGKAT(minta("/api/admin-sekolah/peringkat?alumni=ikut&minimal=2"))).json();
    expect(minimal.baris.map((b: { nama: string }) => b.nama)).toEqual(["Ani", "Budi"]);
    const jenis = await (await GET_PERINGKAT(minta("/api/admin-sekolah/peringkat?jenis=nasional"))).json();
    expect(jenis.baris.map((b: { nama: string }) => b.nama)).toEqual(["Budi"]);
  });
});

describe("GET /api/admin-sekolah/paket", () => {
  it("paket dengan siswa terbanyak di atas; partisipasi dari siswa aktif sejenjang; jumlah paket per jenis", async () => {
    const j = await (await GET_PAKET(minta("/api/admin-sekolah/paket"))).json();
    expect(j.baris.map((b: { nama: string }) => b.nama)).toEqual(["Paket 1", "Nasional 1", "Paket 2"]);
    const p1 = j.baris[0];
    expect(p1).toMatchObject({ packageId: P1, jumlahSiswa: 3, jumlahSiswaAktif: 2, siswaAktifJenjang: 10, partisipasiPersen: 20, perJenis: { mandiri: 3, sekolah: 0, nasional: 0 } });
    expect(j.jumlahPaketPerJenis).toEqual({ semua: 3, mandiri: 1, sekolah: 1, nasional: 1 });
    expect(j.ringkasan).toEqual({ jumlahPaket: 3, jumlahHasil: 5, jumlahSiswa: 3 });
  });

  it("jumlahPaketPerJenis tidak ikut berubah oleh pilihan jenis", async () => {
    const j = await (await GET_PAKET(minta("/api/admin-sekolah/paket?jenis=nasional"))).json();
    expect(j.baris.map((b: { nama: string }) => b.nama)).toEqual(["Nasional 1"]);
    expect(j.jumlahPaketPerJenis).toEqual({ semua: 3, mandiri: 1, sekolah: 1, nasional: 1 });
  });

  it("filter jenis=sekolah hanya paket yang punya hasil jalur sekolah; urut nama", async () => {
    const j = await (await GET_PAKET(minta("/api/admin-sekolah/paket?jenis=sekolah&urut=nama"))).json();
    expect(j.baris.map((b: { nama: string }) => b.nama)).toEqual(["Paket 2"]);
    const urut = await (await GET_PAKET(minta("/api/admin-sekolah/paket?urut=nama"))).json();
    expect(urut.baris.map((b: { nama: string }) => b.nama)).toEqual(["Nasional 1", "Paket 1", "Paket 2"]);
  });
});

describe("GET /api/admin-sekolah/paket/[id]", () => {
  const panggil = (query = "", id = P1) => GET_DETAIL(minta(`/api/admin-sekolah/paket/${id}${query}`), { params: Promise.resolve({ id }) });

  it("paket tidak ada atau tidak boleh dilihat sekolah ini -> 404 tanpa membaca hasil", async () => {
    m.packageFindFirst.mockResolvedValue(null);
    const res = await panggil();
    expect(res.status).toBe(404);
    expect(m.attemptFindMany).not.toHaveBeenCalled();
  });

  it("paket boleh dilihat bila sudah dikerjakan siswa sekolah itu ATAU tersedia untuk sekolah", async () => {
    await panggil();
    const where = m.packageFindFirst.mock.calls[0]![0].where;
    expect(where.id).toBe(P1);
    expect(where.OR[0]).toEqual({ attempts: { some: { student: { schoolId: SEKOLAH, jalur: "A", deletedAt: null } } } });
    expect(where.OR[1]).toMatchObject({ status: "published", ownerType: "pusat" });
  });

  it("peringkat sudah mengerjakan (alumni ikut), belum mengerjakan (siswa aktif tanpa hasil), statistik", async () => {
    m.attemptFindMany.mockImplementation(async (arg: { where: { status: { in: string[] } } }) =>
      arg.where.status.in.includes("berjalan") ? [{ studentId: "s4" }] : PERCOBAAN.filter((p) => p.packageId === P1),
    );
    const j = await (await panggil()).json();
    expect(j.paket).toEqual({ id: P1, nama: "Paket 1", mapel: "Matematika", jenjang: "SMP", jumlahSoal: 30, durasiMenit: 90 });
    expect(j.hasil.map((h: { peringkat: number; nama: string; skor: number }) => [h.peringkat, h.nama, h.skor])).toEqual([
      [1, "Ani", 90],
      [2, "Budi", 60],
      [3, "Citra", 50],
    ]);
    expect(j.hasil[2].alumni).toBe(true);
    expect(j.belum).toEqual([{ studentId: "s4", nama: "Dewi", nisn: null, claimStatus: "belum_klaim", status: "sedang_mengerjakan" }]);
    expect(j.statistik).toMatchObject({ siswaAktif: 3, sudahMengerjakan: 3, sudahMengerjakanAktif: 2, belumMengerjakan: 1, sedangMengerjakan: 1, partisipasiPersen: 67, rataRata: 66.7, tertinggi: 90, terendah: 50 });
    expect(j.jumlahPerJenis).toEqual({ semua: 3, mandiri: 3, sekolah: 0, nasional: 0 });
  });

  it("paket ditentukan alamat: parameter paket, mapel, dan cari dari permintaan tidak menyaring hasilnya", async () => {
    m.attemptFindMany.mockImplementation(async (arg: { where: { status: { in: string[] } } }) => (arg.where.status.in.includes("berjalan") ? [] : PERCOBAAN.filter((p) => p.packageId === P1)));
    const j = await (await panggil(`?paket=${P2}&mapel=${M2}&cari=tidak-ada-yang-bernama-ini`)).json();
    expect(j.hasil.map((h: { nama: string }) => h.nama)).toEqual(["Ani", "Budi", "Citra"]);
  });

  it("alumni dapat dikeluarkan dan jenis menyaring hasil ('belum' mengikuti jenis yang dipilih)", async () => {
    m.attemptFindMany.mockImplementation(async (arg: { where: { status: { in: string[] } } }) => (arg.where.status.in.includes("berjalan") ? [] : PERCOBAAN.filter((p) => p.packageId === P1)));
    const tanpaAlumni = await (await panggil("?alumni=tanpa")).json();
    expect(tanpaAlumni.hasil.map((h: { nama: string }) => h.nama)).toEqual(["Ani", "Budi"]);
    // tidak ada hasil jalur sekolah pada paket ini: semua siswa aktif belum
    const sekolah = await (await panggil("?jenis=sekolah")).json();
    expect(sekolah.hasil).toEqual([]);
    expect(sekolah.belum.map((b: { nama: string }) => b.nama).sort()).toEqual(["Ani", "Budi", "Dewi"]);
  });
});

describe("unduhan Excel", () => {
  async function bacaExcel(res: Response) {
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    const buku = new ExcelJS.Workbook();
    await buku.xlsx.load(Buffer.from(await res.arrayBuffer()) as unknown as ExcelJS.Buffer);
    return buku;
  }

  it("peringkat: lembar Ringkasan dan Peringkat Siswa, nama berkas dari sekolah, syarat dicatat", async () => {
    const res = await GET_PERINGKAT_EXPORT(minta("/api/admin-sekolah/peringkat/export?jenis=mandiri&minimal=1"));
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="peringkat-siswa-smp-negeri-uji-\d{4}-\d{2}-\d{2}\.xlsx"/);
    const buku = await bacaExcel(res);
    expect(buku.worksheets.map((w) => w.name)).toEqual(["Ringkasan", "Peringkat Siswa"]);
    const lembar = buku.getWorksheet("Peringkat Siswa")!;
    expect(lembar.getRow(1).values).toContain("Peringkat");
    // kolom 1 = Peringkat, 2 = Nama (kunci kolom tidak ikut tersimpan di berkas)
    expect(lembar.getRow(2).getCell(2).value).toBe("Ani");
    expect(lembar.getRow(2).getCell(1).value).toBe(1);
    const ringkasan = buku.getWorksheet("Ringkasan")!;
    const teks = JSON.stringify(ringkasan.getSheetValues());
    expect(teks).toContain("Jenis: Try Out Mandiri");
    expect(teks).toContain("SMP Negeri Uji");
  });

  it("peringkat: ?format=pdf menghasilkan PDF sungguhan dengan nama berkas aman", async () => {
    const res = await GET_PERINGKAT_EXPORT(minta("/api/admin-sekolah/peringkat/export?format=pdf&alumni=ikut"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="peringkat-siswa-smp-negeri-uji-\d{4}-\d{2}-\d{2}\.pdf"/);
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("peringkat: format selain xlsx dan pdf ditolak", async () => {
    expect((await GET_PERINGKAT_EXPORT(minta("/api/admin-sekolah/peringkat/export?format=docx"))).status).toBe(400);
  });

  it("nama yang diawali '=' ditulis sebagai teks, bukan rumus", async () => {
    m.attemptFindMany.mockResolvedValue([baris("x1", { ...S1, nama: "=HYPERLINK(\"http://jahat\")" }, K1, { skorAkhir: 90 })]);
    const buku = await bacaExcel(await GET_PERINGKAT_EXPORT(minta("/api/admin-sekolah/peringkat/export")));
    const sel = buku.getWorksheet("Peringkat Siswa")!.getRow(2).getCell(2);
    expect(sel.type).not.toBe(ExcelJS.ValueType.Formula);
    expect(String(sel.value)).toContain("HYPERLINK");
  });

  it("performa paket: lembar Ringkasan, Peringkat, Belum Mengerjakan", async () => {
    m.attemptFindMany.mockImplementation(async (arg: { where: { status: { in: string[] } } }) => (arg.where.status.in.includes("berjalan") ? [] : PERCOBAAN.filter((p) => p.packageId === P1)));
    const res = await GET_DETAIL_EXPORT(minta(`/api/admin-sekolah/paket/${P1}/export`), { params: Promise.resolve({ id: P1 }) });
    expect(res.headers.get("content-disposition")).toMatch(/performa-paket-paket-1-/);
    const buku = await bacaExcel(res);
    expect(buku.worksheets.map((w) => w.name)).toEqual(["Ringkasan", "Peringkat", "Belum Mengerjakan"]);
    expect(buku.getWorksheet("Peringkat")!.rowCount).toBe(4);
    expect(buku.getWorksheet("Belum Mengerjakan")!.getRow(2).getCell(1).value).toBe("Dewi");
  });

  it("performa paket: paket tidak dikenal -> 404", async () => {
    m.packageFindFirst.mockResolvedValue(null);
    const res = await GET_DETAIL_EXPORT(minta(`/api/admin-sekolah/paket/${P1}/export`), { params: Promise.resolve({ id: P1 }) });
    expect(res.status).toBe(404);
  });
});
