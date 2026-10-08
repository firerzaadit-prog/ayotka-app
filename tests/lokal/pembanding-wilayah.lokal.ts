// SEMENTARA - uji integrasi lokal terhadap Postgres sungguhan (PGlite port 54330). Bukan bagian suite normal dan TIDAK di-commit.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ambilPembandingWilayah, kosongkanCachePembandingWilayah } from "@/lib/indikator/pembanding-wilayah";
import { bangunLaporanIndikatorSekolah } from "@/lib/indikator/laporan-sekolah";
import { FILTER_WILAYAH_KOSONG } from "@/lib/wilayah/cakupan";

const db = new PrismaClient({ datasourceUrl: "postgresql://postgres:postgres@127.0.0.1:54330/postgres?sslmode=disable&pgbouncer=true" });

interface Kolom {
  column_name: string;
  udt_name: string;
  data_type: string;
  column_default: string | null;
  is_nullable: string;
}
const kolomCache = new Map<string, Kolom[]>();

/** Sisipkan satu baris: kolom NOT NULL tanpa default yang tidak diberikan diisi nilai generik sesuai tipenya. Mengembalikan id. */
async function sisip(tabel: string, nilai: Record<string, unknown> = {}): Promise<string> {
  let kolom = kolomCache.get(tabel);
  if (!kolom) {
    kolom = await db.$queryRawUnsafe<Kolom[]>(
      `SELECT column_name, udt_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
      tabel,
    );
    kolomCache.set(tabel, kolom);
  }
  const id = (nilai.id as string | undefined) ?? crypto.randomUUID();
  const semua: Record<string, unknown> = { ...nilai, id };
  const nama: string[] = [];
  const nilaiSql: string[] = [];
  const params: unknown[] = [];
  const tipeKolom = new Map(kolom.map((k) => [k.column_name, k]));
  const tambahParam = (n: string, v: unknown) => {
    const k = tipeKolom.get(n);
    if (!k) throw new Error(`kolom ${tabel}.${n} tidak ada`);
    params.push(v instanceof Date ? v.toISOString() : v);
    const cast = k.data_type === "USER-DEFINED" ? `::"${k.udt_name}"` : k.udt_name === "uuid" ? "::uuid" : k.udt_name.startsWith("timestamp") ? "::timestamp" : k.udt_name === "jsonb" ? "::jsonb" : "";
    nama.push(`"${n}"`);
    nilaiSql.push(`$${params.length}${cast}`);
  };
  for (const [n, v] of Object.entries(semua)) tambahParam(n, v);
  for (const k of kolom) {
    if (k.column_name in semua || k.is_nullable === "YES" || k.column_default !== null) continue;
    nama.push(`"${k.column_name}"`);
    if (k.data_type === "USER-DEFINED") {
      nilaiSql.push(`(SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = '${k.udt_name}' ORDER BY e.enumsortorder LIMIT 1)::"${k.udt_name}"`);
    } else if (k.udt_name === "uuid") nilaiSql.push("gen_random_uuid()");
    else if (["text", "varchar"].includes(k.udt_name)) nilaiSql.push(`'g' || substr(md5(random()::text), 1, 14)`);
    else if (["int4", "int8", "int2"].includes(k.udt_name)) nilaiSql.push("0");
    else if (["float8", "float4", "numeric"].includes(k.udt_name)) nilaiSql.push("0");
    else if (k.udt_name === "bool") nilaiSql.push("false");
    else if (k.udt_name.startsWith("timestamp")) nilaiSql.push("NOW()");
    else if (k.udt_name === "jsonb") nilaiSql.push("'{}'::jsonb");
    else if (k.udt_name === "date") nilaiSql.push("CURRENT_DATE");
    else throw new Error(`tipe ${k.udt_name} untuk ${tabel}.${k.column_name} belum ditangani`);
  }
  await db.$executeRawUnsafe(`INSERT INTO "${tabel}" (${nama.join(", ")}) VALUES (${nilaiSql.join(", ")})`, ...params);
  return id;
}

const ids: Record<string, string> = {};
let subjectId = "";
let userBuatSoal = "";
let paketP1 = "";
let paketP2 = "";
let q1 = "";
let q2 = "";
let q3 = "";
let q4 = "";
const mulai = (iso: string) => new Date(iso);

async function buatSekolah(kunci: string, o: { provinsi: string | null; kab: string | null; status: "negeri" | "swasta" | null; akun?: "aktif" | "pending_verifikasi" | "suspend" }) {
  ids[kunci] = await sisip("schools", { nama: `Sekolah ${kunci}`, jenjang: "SMP", status: o.akun ?? "aktif", provinsi: o.provinsi, kabupaten_kota: o.kab, status_sekolah: o.status });
}
async function buatSiswa(kunci: string, sekolah: string, o: { jalur?: "A" | "B"; dihapus?: boolean } = {}) {
  ids[kunci] = await sisip("students", { school_id: ids[sekolah], jenjang: "SMP", nama: kunci, jalur: o.jalur ?? "A", deleted_at: o.dihapus ? new Date() : null });
}
async function percobaan(siswa: string, paket: string, o: { mulaiAt: string; status?: "selesai" | "berjalan" | "kedaluwarsa"; jawaban: Array<[string, number]> }) {
  const idAttempt = await sisip("attempts", { student_id: ids[siswa], package_id: paket, mulai_at: mulai(o.mulaiAt), status: o.status ?? "selesai" });
  for (const [soal, skor] of o.jawaban) await sisip("attempt_answers", { attempt_id: idAttempt, question_id: soal, skor, skor_maks: 1 });
  return idAttempt;
}

beforeAll(async () => {
  await db.$executeRawUnsafe(`DELETE FROM "attempt_answers"`);
  await db.$executeRawUnsafe(`DELETE FROM "attempts"`);
  userBuatSoal = await sisip("users", { email: `pembuat-${crypto.randomUUID()}@uji.test`, role: "admin_pusat", status: "aktif" });
  subjectId = await sisip("subjects", { kode: `MAT-SMP-${crypto.randomUUID().slice(0, 6)}`, nama: "Matematika", jenjang: "SMP" });
  const elemen = await sisip("elemen", { subject_id: subjectId, nama: "Bilangan", urutan: 1 });
  const kompetensi = await sisip("kompetensi", { elemen_id: elemen, sub_elemen: "Sub", deskripsi: "Kompetensi uji", level_kognitif: "L1" });
  const i1 = await sisip("indikator_resmi", { jenjang: "SMP", kd_mapel: "MATP", nama_mapel: "Matematika", elemen: "Bilangan", subelemen: "Sub", kompetensi: "Komp", indikator: "Indikator satu (1)", teks_kunci: `satu-${crypto.randomUUID()}`, urutan: 1, nilai_nasional: 50 });
  const i2 = await sisip("indikator_resmi", { jenjang: "SMP", kd_mapel: "MATP", nama_mapel: "Matematika", elemen: "Bilangan", subelemen: "Sub", kompetensi: "Komp", indikator: "Indikator dua (2)", teks_kunci: `dua-${crypto.randomUUID()}`, urutan: 2, nilai_nasional: 50 });
  ids.i1 = i1;
  ids.i2 = i2;
  paketP1 = await sisip("packages", { subject_id: subjectId, nama: "Paket 1", jenjang: "SMP", owner_type: "pusat", owner_id: userBuatSoal });
  paketP2 = await sisip("packages", { subject_id: subjectId, nama: "Paket 2", jenjang: "SMP", owner_type: "pusat", owner_id: userBuatSoal });
  const soal = (paket: string, indikator: string | null, level: "L1" | "L2" | "L3") =>
    sisip("questions", { package_id: paket, kompetensi_id: kompetensi, created_by: userBuatSoal, level_bloom: level, indikator_id: indikator });
  q1 = await soal(paketP1, i1, "L1");
  q2 = await soal(paketP1, i2, "L2");
  q3 = await soal(paketP1, null, "L3");
  q4 = await soal(paketP2, i1, "L1");

  await buatSekolah("A", { provinsi: "Jawa Timur", kab: "Kota Malang", status: "negeri" });
  await buatSekolah("B", { provinsi: "Jawa Timur", kab: "Kota Surabaya", status: "swasta" });
  await buatSekolah("C", { provinsi: "Jawa Timur", kab: "Kabupaten Malang", status: "negeri" });
  await buatSekolah("D", { provinsi: "Jawa Barat", kab: "Kota Bandung", status: "negeri" });
  await buatSekolah("E", { provinsi: null, kab: "Kota Malang", status: null }); // data lama: provinsi belum terisi
  await buatSekolah("F", { provinsi: "Jawa Timur", kab: "Kota Malang", status: "negeri", akun: "pending_verifikasi" });
  await buatSekolah("G", { provinsi: "Jawa Timur", kab: "Kota Malang", status: "negeri", akun: "suspend" });

  const T = "2026-10-05T03:00:00Z";
  await buatSiswa("A1", "A");
  await buatSiswa("A2", "A");
  await buatSiswa("A3", "A", { jalur: "B" }); // siswa mandiri: tidak dihitung
  await buatSiswa("A4", "A", { dihapus: true }); // dihapus: tidak dihitung
  await buatSiswa("B1", "B");
  await buatSiswa("B2", "B");
  await buatSiswa("C1", "C");
  for (let n = 1; n <= 8; n++) await buatSiswa(`D${n}`, "D");
  await buatSiswa("E1", "E");
  await buatSiswa("F1", "F");
  await buatSiswa("G1", "G");

  // Percobaan pertama (jawaban Q1,Q2 + Q3 tanpa indikator)
  await percobaan("A1", paketP1, { mulaiAt: "2026-09-10T03:00:00Z", jawaban: [[q1, 1], [q2, 1], [q3, 1]] });
  await percobaan("A1", paketP1, { mulaiAt: "2026-10-12T03:00:00Z", jawaban: [[q1, 0], [q2, 0], [q3, 0]] }); // ulang: bukan percobaan pertama
  await percobaan("A1", paketP2, { mulaiAt: "2026-10-13T03:00:00Z", status: "berjalan", jawaban: [[q4, 1]] }); // belum selesai
  await percobaan("A2", paketP1, { mulaiAt: T, jawaban: [[q1, 0], [q2, 1], [q3, 1]] });
  await percobaan("A2", paketP2, { mulaiAt: "2026-10-06T03:00:00Z", jawaban: [[q4, 0]] });
  await percobaan("A3", paketP1, { mulaiAt: T, jawaban: [[q1, 0], [q2, 0]] });
  await percobaan("A4", paketP1, { mulaiAt: T, jawaban: [[q1, 0], [q2, 0]] });
  await percobaan("B1", paketP1, { mulaiAt: T, jawaban: [[q1, 1], [q2, 0]] });
  await percobaan("B2", paketP1, { mulaiAt: T, jawaban: [[q1, 1], [q2, 0]] });
  await percobaan("C1", paketP1, { mulaiAt: T, jawaban: [[q1, 0], [q2, 0]] });
  for (let n = 1; n <= 8; n++) await percobaan(`D${n}`, paketP1, { mulaiAt: T, jawaban: [[q1, 1], [q2, 1]] });
  await percobaan("E1", paketP1, { mulaiAt: T, jawaban: [[q1, 1], [q2, 1]] });
  await percobaan("F1", paketP1, { mulaiAt: T, jawaban: [[q1, 0], [q2, 0]] });
  await percobaan("G1", paketP1, { mulaiAt: T, jawaban: [[q1, 0], [q2, 0]] });
});

afterAll(async () => {
  await db.$disconnect();
});

const ambil = (filter: Partial<typeof FILTER_WILAYAH_KOSONG>, rentang?: { dari?: Date; sampai?: Date }, sendiri = "A") => {
  kosongkanCachePembandingWilayah();
  return ambilPembandingWilayah(db, { schoolIdSendiri: ids[sendiri]!, subjectId, filter: { ...FILTER_WILAYAH_KOSONG, ...filter }, rentang });
};

describe("SQL pembanding wilayah pada Postgres sungguhan", () => {
  it("nasional: hanya sekolah aktif, siswa Jalur A yang belum dihapus, percobaan pertama yang selesai", async () => {
    const p = await ambil({});
    // sekolah A(3/5) B(2/4) C(0/2) D(16/16) E(2/2); F pending dan G suspend tidak ikut
    expect(p.jumlahSekolah).toBe(5);
    expect(p.jumlahSiswa).toBe(2 + 2 + 1 + 8 + 1);
    expect(p.cukup).toBe(true);
    expect(p.rerata).toBeCloseTo((23 / 29) * 100, 5);
    expect(p.perIndikator[ids.i1!]).toMatchObject({ jmlJawaban: 15, jmlSekolah: 5 });
    expect(p.perIndikator[ids.i1!]!.dayaSerap).toBeCloseTo((12 / 15) * 100, 5);
    expect(p.perIndikator[ids.i2!]).toMatchObject({ jmlJawaban: 14, jmlSekolah: 5 });
    expect(p.perIndikator[ids.i2!]!.dayaSerap).toBeCloseTo((11 / 14) * 100, 5);
  });

  it("posisi sekolah A: peringkat 3 dari 5 (di bawah D dan E; di atas B dan C)", async () => {
    const p = await ambil({});
    expect(p.posisi).toEqual({ peringkat: 3, dari: 5, persentil: 50 });
  });

  it("provinsi Jawa Timur: ikut sekolah yang kolom provinsinya masih kosong tetapi kota-nya di Jawa Timur (E)", async () => {
    const p = await ambil({ provinsi: "Jawa Timur" });
    expect(p.jumlahSekolah).toBe(4); // A, B, C, E
    expect(p.rerata).toBeCloseTo((7 / 13) * 100, 5);
    expect(p.perIndikator).toEqual({}); // I1 baru 7 jawaban, I2 baru 6: di bawah ambang 10 jawaban
  });

  it("provinsi Jawa Barat: hanya satu sekolah -> belum cukup, tidak ada angka", async () => {
    const p = await ambil({ provinsi: "Jawa Barat" }, undefined, "D");
    expect(p).toMatchObject({ cukup: false, jumlahSekolah: 1, rerata: null, posisi: null });
  });

  it("kota/kabupaten Kota Malang: A dan E (F pending tidak ikut) -> 2 sekolah, belum cukup", async () => {
    const p = await ambil({ provinsi: "Jawa Timur", kabupatenKota: "Kota Malang" });
    expect(p).toMatchObject({ cukup: false, jumlahSekolah: 2 });
  });

  it("status negeri: A, C, D (E tanpa status tidak ikut)", async () => {
    const p = await ambil({ statusSekolah: "negeri" });
    expect(p.jumlahSekolah).toBe(3);
    expect(p.rerata).toBeCloseTo((19 / 23) * 100, 5);
  });

  it("status swasta: hanya B -> belum cukup", async () => {
    expect(await ambil({ statusSekolah: "swasta" })).toMatchObject({ cukup: false, jumlahSekolah: 1 });
  });

  it("rentang waktu: percobaan pertama dipilih DI DALAM rentang (A1 percobaan 10 Sep di luar rentang, jadi percobaan 12 Okt yang dihitung)", async () => {
    const p = await ambil({}, { dari: mulai("2026-10-01T00:00:00Z") });
    // A: A1 (Okt-12: 0/2) + A2 (Q1 0, Q2 1, P2 Q4 0 -> 1/3) = 1/5 -> turun dari 3/5; total skor 21 dari 29
    expect(p.rerata).toBeCloseTo((21 / 29) * 100, 5);
  });

  it("batas rentang: sampai tepat pada waktu mulai percobaan masih termasuk (<=), dan dari tepat (>=)", async () => {
    const tepat = await ambil({ provinsi: "Jawa Barat" }, { dari: mulai("2026-10-05T03:00:00Z"), sampai: mulai("2026-10-05T03:00:00Z") }, "D");
    expect(tepat.jumlahSekolah).toBe(1);
    const lewat = await ambil({ provinsi: "Jawa Barat" }, { dari: mulai("2026-10-05T03:00:00.001Z") }, "D");
    expect(lewat.jumlahSekolah).toBe(0);
  });

  it("sekolah sendiri di luar cakupan: pembanding tetap ada, posisi null", async () => {
    const p = await ambil({ statusSekolah: "swasta" }, undefined, "A"); // A negeri, cakupan swasta
    expect(p.posisi).toBeNull();
  });
});

describe("bangunLaporanIndikatorSekolah dengan pembanding sungguhan", () => {
  it("laporan sekolah A memuat pembanding nasional, angka wilayah per indikator, tren, level, dan wawasan", async () => {
    kosongkanCachePembandingWilayah();
    const data = await bangunLaporanIndikatorSekolah(db, ids.A!, subjectId, null, { pembanding: FILTER_WILAYAH_KOSONG });
    expect(data).not.toBeNull();
    expect(data!.sekolah).toMatchObject({ nama: "Sekolah A", provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: "negeri" });
    expect(data!.pembanding).toMatchObject({ cukup: true, jumlahSekolah: 5 });
    const lap = data!.laporan!;
    const baris = lap.kelompok.flatMap((k) => k.baris);
    expect(baris.find((b) => b.indikatorId === ids.i1)!.wilayah).toBeCloseTo(80, 5);
    expect(baris.find((b) => b.indikatorId === ids.i2)!.wilayah).toBeCloseTo((11 / 14) * 100, 5);
    expect(lap.kelompok[0]).toHaveProperty("wilayah");
    // tren: percobaan pertama A1 (Sep) + A2 (Okt, dua paket)
    expect(lap.tren.map((t) => t.periode)).toEqual(["2026-09", "2026-10"]);
    expect(lap.perLevel.map((l) => l.level)).toEqual(["L1", "L2"]); // Q3 tanpa indikator tidak masuk
    expect(data!.wawasan!.length).toBeGreaterThan(0);
    expect(data!.wawasan!.some((w) => /rerata pengguna AyoTKA/.test(w.teks))).toBe(true);
  });

  it("tanpa permintaan pembanding: tidak dihitung dan tidak ada bidang wilayah", async () => {
    const data = await bangunLaporanIndikatorSekolah(db, ids.A!, subjectId, null);
    expect(data!.pembanding).toBeNull();
    for (const b of data!.laporan!.kelompok.flatMap((k) => k.baris)) expect(b).not.toHaveProperty("wilayah");
  });

  it("pembanding belum cukup (satu sekolah): laporan tetap lengkap tanpa angka wilayah, ada penjelasan", async () => {
    kosongkanCachePembandingWilayah();
    const data = await bangunLaporanIndikatorSekolah(db, ids.A!, subjectId, null, { pembanding: { provinsi: "Jawa Barat", kabupatenKota: null, statusSekolah: null } });
    expect(data!.pembanding).toMatchObject({ cukup: false });
    for (const b of data!.laporan!.kelompok.flatMap((k) => k.baris)) expect(b).not.toHaveProperty("wilayah");
    expect(data!.wawasan![0]!.teks).toMatch(/belum tersedia/);
  });
});
