import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  resolveSchoolId: vi.fn(),
  checkRateLimit: vi.fn(),
  bacaRentangPeriode: vi.fn(),
  periodeFind: vi.fn(),
  daftarMapel: vi.fn(),
  bangun: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/schools/scope", () => ({ resolveSchoolId: m.resolveSchoolId }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.checkRateLimit }));
vi.mock("@/lib/analytics/rentang", () => ({ bacaRentangPeriode: m.bacaRentangPeriode }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { periodeLangganan: { findFirst: m.periodeFind }, penanda: "prisma-tiruan" } }));
vi.mock("@/lib/indikator/laporan-sekolah", () => ({ daftarMapelLaporan: m.daftarMapel, bangunLaporanIndikatorSekolah: m.bangun }));

import { GET as getJson } from "@/app/api/admin-sekolah/laporan-indikator/route";
import { GET as getPdf } from "@/app/api/admin-sekolah/laporan-indikator/pdf/route";
import { GET as getExcel } from "@/app/api/admin-sekolah/laporan-indikator/excel/route";
import { slugBerkas } from "@/lib/indikator/laporan-param";
import { hitungLaporanSekolah, type InfoIndikator, type JawabanSiswa } from "@/lib/indikator/daya-serap";
import { susunPembanding } from "@/lib/indikator/pembanding";
import { susunWawasan } from "@/lib/indikator/wawasan";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const PERIODE = "22222222-2222-4222-8222-222222222222";
const req = (qs = "") => new Request(`https://ayotka.id/api/admin-sekolah/laporan-indikator${qs}`);

const ind = (n: number): InfoIndikator => ({
  id: `m${n}`,
  jenjang: "SMP",
  namaMapel: "Matematika",
  elemen: "Bilangan",
  subelemen: "Bilangan Real",
  kompetensi: "Kemampuan X",
  indikator: `Indikator ${n} (${n})`,
  urutan: n,
  nilaiNasional: 50,
});
function dataContoh() {
  const jawaban: JawabanSiswa[] = [];
  for (let s = 0; s < 8; s++) for (let n = 1; n <= 3; n++) jawaban.push({ studentId: `s${s}`, indikator: ind(n), skor: (s + n) % 3 === 0 ? 1 : 0, skorMaks: 1 });
  const siswa = Array.from({ length: 8 }, (_, s) => ({ studentId: `s${s}`, nama: `Siswa ${s}`, nisn: `N${s}` }));
  return {
    sekolah: { id: "sek-1", nama: "SMP Negeri 1 Contoh" },
    mapel: { subjectId: SUBJECT, nama: "Matematika", jenjang: "SMP" },
    jumlahSiswaMengerjakan: 8,
    jumlahPercobaan: 8,
    jumlahPaket: 1,
    laporan: hitungLaporanSekolah(jawaban, siswa),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "admin-1", role: "admin_sekolah" });
  m.resolveSchoolId.mockResolvedValue("sek-1");
  m.checkRateLimit.mockReturnValue(true);
  m.bacaRentangPeriode.mockResolvedValue({ rentang: null });
  m.periodeFind.mockResolvedValue(null);
  m.daftarMapel.mockResolvedValue([{ subjectId: SUBJECT, nama: "Matematika", jenjang: "SMP", jumlahPercobaan: 8 }]);
  m.bangun.mockResolvedValue(dataContoh());
});

describe.each([
  ["JSON", getJson],
  ["PDF", getPdf],
  ["Excel", getExcel],
] as const)("otorisasi dan parameter bersama - rute %s", (_nama, GET) => {
  it("403 bila bukan admin sekolah/pusat, tanpa menyentuh data", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await GET(req(`?subjectId=${SUBJECT}`));
    expect(res.status).toBe(403);
    expect(m.daftarMapel).not.toHaveBeenCalled();
    expect(m.bangun).not.toHaveBeenCalled();
  });

  it("403 bila akun belum terhubung ke sekolah", async () => {
    m.resolveSchoolId.mockResolvedValue(null);
    expect((await GET(req(`?subjectId=${SUBJECT}`))).status).toBe(403);
    expect(m.bangun).not.toHaveBeenCalled();
  });

  it("429 bila melewati batas permintaan", async () => {
    m.checkRateLimit.mockReturnValue(false);
    expect((await GET(req(`?subjectId=${SUBJECT}`))).status).toBe(429);
    expect(m.bangun).not.toHaveBeenCalled();
  });

  it("400 bila subjectId bukan UUID", async () => {
    const res = await GET(req("?subjectId=bukan-uuid"));
    expect(res.status).toBe(400);
    expect(m.bangun).not.toHaveBeenCalled();
  });

  it("galat periode (bukan milik sekolah / tidak ada) diteruskan apa adanya", async () => {
    m.bacaRentangPeriode.mockResolvedValue({ galat: NextResponse.json({ error: "Periode tidak ditemukan." }, { status: 404 }) });
    const res = await GET(req(`?subjectId=${SUBJECT}&periodeId=${PERIODE}`));
    expect(res.status).toBe(404);
    expect(m.bangun).not.toHaveBeenCalled();
  });

  it("sekolah SELALU dari sesi: ?schoolId= palsu diabaikan sama sekali", async () => {
    await GET(req(`?subjectId=${SUBJECT}&schoolId=sekolah-lain`));
    expect(m.resolveSchoolId).toHaveBeenCalledWith({ id: "admin-1", role: "admin_sekolah" }, null);
    for (const panggilan of [...m.daftarMapel.mock.calls, ...m.bangun.mock.calls]) {
      expect(panggilan[1]).toBe("sek-1");
    }
  });

  it("404 bila mapel/sekolah tidak ditemukan", async () => {
    m.bangun.mockResolvedValue(null);
    expect((await GET(req(`?subjectId=${SUBJECT}`))).status).toBe(404);
  });
});

describe("GET /api/admin-sekolah/laporan-indikator (JSON)", () => {
  it("tanpa subjectId: hanya daftar mapel, laporan tidak dihitung", async () => {
    const res = await getJson(req());
    expect(res.status).toBe(200);
    const isi = await res.json();
    expect(isi.mapel).toHaveLength(1);
    expect(isi.data).toBeNull();
    expect(isi.periodeLabel).toBe("Semua waktu");
    expect(m.bangun).not.toHaveBeenCalled();
  });

  it("dengan subjectId: mengembalikan laporan lengkap", async () => {
    const res = await getJson(req(`?subjectId=${SUBJECT}`));
    const isi = await res.json();
    expect(isi.data.laporan.label).toEqual(["Elemen", "Subelemen", "Kompetensi", "Indikator"]);
    expect(isi.data.jumlahSiswaMengerjakan).toBe(8);
    expect(m.bangun).toHaveBeenCalledWith(
      { periodeLangganan: expect.anything(), penanda: "prisma-tiruan" },
      "sek-1",
      SUBJECT,
      null,
      // tanpa parameter wilayah = pembanding nasional (semua pengguna AyoTKA, negeri + swasta)
      { pembanding: { provinsi: null, kabupatenKota: null, statusSekolah: null } },
    );
  });

  it("periode dipilih: rentang diteruskan dan labelnya memuat nama dan tanggal periode", async () => {
    const rentang = { dari: new Date("2026-07-01T00:00:00Z"), sampai: new Date("2026-12-31T16:59:59Z") };
    m.bacaRentangPeriode.mockResolvedValue({ rentang });
    m.periodeFind.mockResolvedValue({ nama: "Semester Ganjil 2026/27", mulai: new Date("2026-07-01T00:00:00Z"), berakhir: new Date("2026-12-31T16:59:59Z") });
    const isi = await (await getJson(req(`?subjectId=${SUBJECT}&periodeId=${PERIODE}`))).json();
    expect(m.bangun.mock.calls[0]![3]).toBe(rentang);
    expect(isi.periodeLabel).toContain("Semester Ganjil 2026/27");
    expect(isi.periodeLabel).toMatch(/Juli 2026/);
    expect(m.periodeFind).toHaveBeenCalledWith(expect.objectContaining({ where: { id: PERIODE, schoolId: "sek-1", dicabutAt: null } }));
  });

  it("periode tanpa nama diberi label bawaan", async () => {
    m.bacaRentangPeriode.mockResolvedValue({ rentang: null });
    m.periodeFind.mockResolvedValue({ nama: null, mulai: new Date("2026-07-01T00:00:00Z"), berakhir: new Date("2026-12-31T00:00:00Z") });
    const isi = await (await getJson(req(`?subjectId=${SUBJECT}&periodeId=${PERIODE}`))).json();
    expect(isi.periodeLabel).toContain("Periode langganan");
  });
});

describe.each([
  ["JSON", getJson],
  ["PDF", getPdf],
  ["Excel", getExcel],
] as const)("pembanding pengguna AyoTKA (?provinsi=, ?kabupatenKota=, ?statusSekolah=) - rute %s", (_nama, GET) => {
  const pembandingDiteruskan = () => (m.bangun.mock.calls[0]![4] as { pembanding: unknown }).pembanding;

  it("provinsi + kota/kabupaten + status diteruskan ke penyusun laporan", async () => {
    const res = await GET(req(`?subjectId=${SUBJECT}&provinsi=Jawa%20Timur&kabupatenKota=Kota%20Malang&statusSekolah=negeri`));
    expect(res.status).toBe(200);
    expect(pembandingDiteruskan()).toEqual({ provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: "negeri" });
  });

  it("hanya kota/kabupaten: provinsi dilengkapi", async () => {
    await GET(req(`?subjectId=${SUBJECT}&kabupatenKota=Kota%20Bandung`));
    expect(pembandingDiteruskan()).toEqual({ provinsi: "Jawa Barat", kabupatenKota: "Kota Bandung", statusSekolah: null });
  });

  it("wilayah di LUAR wilayah sekolah sendiri boleh dipilih (hanya angka gabungan yang keluar)", async () => {
    await GET(req(`?subjectId=${SUBJECT}&provinsi=Bali`));
    expect(pembandingDiteruskan()).toEqual({ provinsi: "Bali", kabupatenKota: null, statusSekolah: null });
  });

  it.each([
    ["pasangan tidak cocok", "provinsi=Bali&kabupatenKota=Kota%20Malang"],
    ["provinsi tidak dikenal", "provinsi=Atlantis"],
    ["status tidak valid", "statusSekolah=yayasan"],
  ])("%s: 400 dan laporan tidak dihitung", async (_n, qs) => {
    const res = await GET(req(`?subjectId=${SUBJECT}&${qs}`));
    expect(res.status).toBe(400);
    expect(m.bangun).not.toHaveBeenCalled();
    expect(m.daftarMapel).not.toHaveBeenCalled();
  });
});

describe("laporan dengan pembanding dan wawasan - JSON, PDF, Excel", () => {
  const pembandingCukup = () =>
    susunPembanding({
      filter: { provinsi: "Jawa Timur", kabupatenKota: null, statusSekolah: "negeri" },
      indikator: [1, 2, 3].map((n) => ({ indikatorId: `m${n}`, skor: 55, skorMaks: 100, jmlSoal: 100, jmlSekolah: 6 })),
      sekolah: [60, 50, 70, 40].map((s, i) => ({ schoolId: i === 0 ? "sek-1" : `lain-${i}`, skor: s, skorMaks: 100, jmlSiswa: 20 })),
      schoolIdSendiri: "sek-1",
    });
  const dataLengkap = () => {
    const pb = pembandingCukup();
    const jawaban: JawabanSiswa[] = [];
    for (let s = 0; s < 8; s++) for (let n = 1; n <= 3; n++) jawaban.push({ studentId: `s${s}`, indikator: ind(n), skor: (s + n) % 3 === 0 ? 1 : 0, skorMaks: 1, bulan: s < 4 ? "2026-09" : "2026-10", level: n === 1 ? "L1" : "L3" });
    const siswa = Array.from({ length: 8 }, (_, s) => ({ studentId: `s${s}`, nama: `Siswa ${s}`, nisn: `N${s}` }));
    const peta = new Map(Object.entries(pb.perIndikator).map(([id, p]) => [id, p.dayaSerap] as const));
    const laporan = hitungLaporanSekolah(jawaban, siswa, { pembandingWilayah: peta })!;
    return {
      ...dataContoh(),
      sekolah: { id: "sek-1", nama: "SMP Negeri 1 Contoh", provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: "negeri" as const },
      laporan,
      pembanding: pb,
      wawasan: susunWawasan(laporan, pb),
    };
  };

  it("JSON: pembanding, wawasan, tren, dan level ikut dikirim; sekolah membawa wilayah dan statusnya", async () => {
    m.bangun.mockResolvedValue(dataLengkap());
    const isi = await (await getJson(req(`?subjectId=${SUBJECT}&provinsi=Jawa%20Timur&statusSekolah=negeri`))).json();
    expect(isi.data.pembanding).toMatchObject({ cukup: true, label: "Provinsi Jawa Timur · Negeri", jumlahSekolah: 4 });
    expect(isi.data.sekolah).toMatchObject({ provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: "negeri" });
    expect(isi.data.wawasan.length).toBeGreaterThan(0);
    expect(isi.data.laporan.tren.map((t: { periode: string }) => t.periode)).toEqual(["2026-09", "2026-10"]);
    expect(isi.data.laporan.perLevel.map((l: { level: string }) => l.level)).toEqual(["L1", "L3"]);
    expect(isi.data.laporan.kelompok[0]).toHaveProperty("wilayah");
  });

  it("PDF dengan pembanding dan wawasan: berkas sah, memuat blok wawasan, pembanding, tren, dan rerata wilayah", async () => {
    m.bangun.mockResolvedValue(dataLengkap());
    const res = await getPdf(req(`?subjectId=${SUBJECT}`));
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("Excel dengan pembanding dan wawasan: lembar Wawasan, kolom wilayah, dan lembar Tren dan Level", async () => {
    m.bangun.mockResolvedValue(dataLengkap());
    const res = await getExcel(req(`?subjectId=${SUBJECT}`));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await res.arrayBuffer()) as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Ringkasan", "Wawasan", "Per Kelompok", "Per Indikator", "Prioritas Remedial", "Di Bawah Nasional", "Tren dan Level", "Siswa Perlu Perhatian"]);
    const kepalaInd = (wb.getWorksheet("Per Indikator")!.getRow(1).values as unknown[]).slice(1);
    expect(kepalaInd).toEqual(expect.arrayContaining(["Rerata AyoTKA Provinsi Jawa Timur · Negeri (%)", "Selisih wilayah (poin)"]));
  });
});

describe("GET .../pdf dan .../excel", () => {
  it("400 bila subjectId tidak diberikan", async () => {
    expect((await getPdf(req())).status).toBe(400);
    expect((await getExcel(req())).status).toBe(400);
    expect(m.bangun).not.toHaveBeenCalled();
  });

  it("PDF: berkas PDF sungguhan dengan nama berkas aman dan tanpa cache", async () => {
    const res = await getPdf(req(`?subjectId=${SUBJECT}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="laporan-indikator-matematika-smp-negeri-1-contoh.pdf"');
    expect(res.headers.get("cache-control")).toBe("no-store");
    const isi = Buffer.from(await res.arrayBuffer());
    expect(isi.subarray(0, 5).toString()).toBe("%PDF-");
    expect(isi.length).toBeGreaterThan(5000);
  });

  it("Excel: berkas xlsx sungguhan dengan nama berkas aman dan tanpa cache", async () => {
    const res = await getExcel(req(`?subjectId=${SUBJECT}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="laporan-indikator-matematika-smp-negeri-1-contoh.xlsx"');
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 2).toString()).toBe("PK");
  });

  it("laporan kosong (tanpa soal berindikator resmi) tetap menghasilkan PDF dan Excel yang sah", async () => {
    m.bangun.mockResolvedValue({ ...dataContoh(), laporan: null });
    expect(Buffer.from(await (await getPdf(req(`?subjectId=${SUBJECT}`))).arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
    expect(Buffer.from(await (await getExcel(req(`?subjectId=${SUBJECT}`))).arrayBuffer()).subarray(0, 2).toString()).toBe("PK");
  });
});

describe("slugBerkas", () => {
  it("huruf kecil, spasi jadi strip, karakter berbahaya dibuang", () => {
    expect(slugBerkas("SMP Negeri 1 Contoh")).toBe("smp-negeri-1-contoh");
    expect(slugBerkas('  Bahasa  Indonesia / "SD" ')).toBe("bahasa-indonesia-sd");
    expect(slugBerkas("../../etc/passwd")).toBe("etcpasswd");
    expect(slugBerkas("a\r\nb: c")).toBe("a-b-c");
  });
  it("kosong/hanya simbol -> 'laporan'; sangat panjang dipotong", () => {
    expect(slugBerkas("***")).toBe("laporan");
    expect(slugBerkas("")).toBe("laporan");
    expect(slugBerkas("x".repeat(200)).length).toBe(60);
  });
  it("tidak pernah memuat karakter yang bisa menyuntik header (kutip, titik koma, baris baru)", () => {
    for (const s of ['"; filename="x', "a\nSet-Cookie: x=1", "é à ñ ü", "名前"]) {
      expect(slugBerkas(s)).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
