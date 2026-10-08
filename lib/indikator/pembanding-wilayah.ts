import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { RentangWaktu } from "@/lib/analytics/sekolah";
import { kabupatenKotaDiProvinsi } from "@/lib/wilayah";
import type { FilterWilayah } from "@/lib/wilayah/cakupan";
import {
  susunPembanding,
  type AgregatIndikatorWilayah,
  type AgregatSekolahWilayah,
  type PembandingWilayah,
} from "./pembanding";

/**
 * Agregat pembanding wilayah dari database: daya serap seluruh sekolah AyoTKA (Jalur A, siswa belum dihapus, sekolah aktif)
 * pada SATU mata pelajaran, dibatasi wilayah (provinsi / kota-kabupaten) dan status sekolah, dari percobaan PERTAMA tiap siswa
 * pada tiap paket (aturan yang sama dengan laporan sekolah dan rapor siswa). Satu pass agregat SQL, bukan memuat jawaban ke
 * memori, karena cakupan nasional bisa ratusan ribu jawaban. Hasil mentah disimpan sebentar di memori (TTL pendek) karena
 * laporan sering dibuka berulang dan angka pembanding tidak perlu real-time.
 */

const TTL_MS = 60_000;
const MAKS_ENTRI_CACHE = 200;

interface Mentah {
  indikator: AgregatIndikatorWilayah[];
  sekolah: AgregatSekolahWilayah[];
}
const cache = new Map<string, { sampai: number; nilai: Mentah }>();

/** Hanya untuk tes. */
export function kosongkanCachePembandingWilayah() {
  cache.clear();
}

interface BarisIndikatorSql {
  indikator_id: string;
  skor: number;
  skor_maks: number;
  jml_soal: number;
  jml_sekolah: number;
}
interface BarisSekolahSql {
  school_id: string;
  skor: number;
  skor_maks: number;
  jml_siswa: number;
}

/** Skor satu jawaban dijepit ke 0..skor maksimum (sama dengan skorBersih di daya-serap.ts). */
const SKOR_BERSIH = Prisma.sql`LEAST(GREATEST(COALESCE(aa.skor, 0), 0), aa.skor_maks)`;

function kondisiWilayah(f: FilterWilayah): Prisma.Sql {
  const bagian: Prisma.Sql[] = [];
  if (f.kabupatenKota) {
    bagian.push(Prisma.sql`AND sc.kabupaten_kota = ${f.kabupatenKota}`);
  } else if (f.provinsi) {
    const kota = [...kabupatenKotaDiProvinsi(f.provinsi)];
    bagian.push(
      kota.length > 0
        ? Prisma.sql`AND (sc.provinsi = ${f.provinsi} OR sc.kabupaten_kota IN (${Prisma.join(kota)}))`
        : Prisma.sql`AND sc.provinsi = ${f.provinsi}`,
    );
  }
  if (f.statusSekolah) bagian.push(Prisma.sql`AND sc.status_sekolah = ${f.statusSekolah}::"StatusSekolah"`);
  return bagian.length > 0 ? Prisma.join(bagian, " ") : Prisma.empty;
}

function kondisiRentang(rentang?: RentangWaktu | null): Prisma.Sql {
  const bagian: Prisma.Sql[] = [];
  // Kolom mulai_at bertipe timestamp tanpa zona yang menyimpan UTC; ISO string + ::timestamp memastikan pembandingan UTC pada
  // zona waktu sesi apa pun (zona di akhir string diabaikan Postgres untuk timestamp tanpa zona).
  if (rentang?.dari) bagian.push(Prisma.sql`AND a.mulai_at >= ${rentang.dari.toISOString()}::timestamp`);
  if (rentang?.sampai) bagian.push(Prisma.sql`AND a.mulai_at <= ${rentang.sampai.toISOString()}::timestamp`);
  return bagian.length > 0 ? Prisma.join(bagian, " ") : Prisma.empty;
}

function kunciCache(subjectId: string, f: FilterWilayah, rentang?: RentangWaktu | null): string {
  return JSON.stringify([subjectId, f.provinsi, f.kabupatenKota, f.statusSekolah, rentang?.dari?.getTime() ?? null, rentang?.sampai?.getTime() ?? null]);
}

/** Percobaan pertama (selesai/kedaluwarsa) tiap siswa pada tiap paket, di sekolah aktif yang cocok dengan wilayah/status. */
function percobaanPertama(subjectId: string, f: FilterWilayah, rentang?: RentangWaktu | null): Prisma.Sql {
  return Prisma.sql`
    SELECT DISTINCT ON (a.student_id, a.package_id) a.id AS attempt_id, a.student_id, s.school_id
    FROM attempts a
    JOIN students s ON s.id = a.student_id
    JOIN schools sc ON sc.id = s.school_id
    JOIN packages p ON p.id = a.package_id
    WHERE a.status IN ('selesai', 'kedaluwarsa')
      AND s.jalur = 'A'
      AND s.deleted_at IS NULL
      AND sc.status = 'aktif'
      AND p.subject_id = ${subjectId}::uuid
      ${kondisiWilayah(f)}
      ${kondisiRentang(rentang)}
    ORDER BY a.student_id, a.package_id, a.mulai_at ASC, a.id ASC`;
}

async function hitungMentah(db: PrismaClient, subjectId: string, f: FilterWilayah, rentang?: RentangWaktu | null): Promise<Mentah> {
  const pertama = percobaanPertama(subjectId, f, rentang);
  const [indikator, sekolah] = await Promise.all([
    db.$queryRaw<BarisIndikatorSql[]>(Prisma.sql`
      WITH pertama AS (${pertama})
      SELECT q.indikator_id AS indikator_id,
             COALESCE(SUM(${SKOR_BERSIH}), 0)::float8 AS skor,
             COALESCE(SUM(aa.skor_maks), 0)::float8 AS skor_maks,
             COUNT(*)::int AS jml_soal,
             COUNT(DISTINCT pr.school_id)::int AS jml_sekolah
      FROM pertama pr
      JOIN attempt_answers aa ON aa.attempt_id = pr.attempt_id
      JOIN questions q ON q.id = aa.question_id
      WHERE q.indikator_id IS NOT NULL AND aa.skor_maks > 0
      GROUP BY q.indikator_id`),
    db.$queryRaw<BarisSekolahSql[]>(Prisma.sql`
      WITH pertama AS (${pertama})
      SELECT pr.school_id AS school_id,
             COALESCE(SUM(${SKOR_BERSIH}), 0)::float8 AS skor,
             COALESCE(SUM(aa.skor_maks), 0)::float8 AS skor_maks,
             COUNT(DISTINCT pr.student_id)::int AS jml_siswa
      FROM pertama pr
      JOIN attempt_answers aa ON aa.attempt_id = pr.attempt_id
      JOIN questions q ON q.id = aa.question_id
      WHERE q.indikator_id IS NOT NULL AND aa.skor_maks > 0
      GROUP BY pr.school_id`),
  ]);
  return {
    indikator: indikator.map((r) => ({
      indikatorId: r.indikator_id,
      skor: Number(r.skor),
      skorMaks: Number(r.skor_maks),
      jmlSoal: Number(r.jml_soal),
      jmlSekolah: Number(r.jml_sekolah),
    })),
    sekolah: sekolah.map((r) => ({ schoolId: r.school_id, skor: Number(r.skor), skorMaks: Number(r.skor_maks), jmlSiswa: Number(r.jml_siswa) })),
  };
}

/**
 * Pembanding AyoTKA untuk satu mata pelajaran pada wilayah/status yang dipilih. `schoolIdSendiri` hanya dipakai untuk
 * menentukan posisi sekolah pemilik laporan; identitas sekolah lain tidak pernah keluar dari modul ini.
 */
export async function ambilPembandingWilayah(
  db: PrismaClient,
  input: { schoolIdSendiri: string; subjectId: string; filter: FilterWilayah; rentang?: RentangWaktu | null; sekarang?: number },
): Promise<PembandingWilayah> {
  const sekarang = input.sekarang ?? Date.now();
  const kunci = kunciCache(input.subjectId, input.filter, input.rentang);
  let mentah = cache.get(kunci);
  if (!mentah || mentah.sampai <= sekarang) {
    mentah = { sampai: sekarang + TTL_MS, nilai: await hitungMentah(db, input.subjectId, input.filter, input.rentang) };
    if (cache.size >= MAKS_ENTRI_CACHE) cache.delete(cache.keys().next().value as string);
    cache.set(kunci, mentah);
  }
  return susunPembanding({ filter: input.filter, indikator: mentah.nilai.indikator, sekolah: mentah.nilai.sekolah, schoolIdSendiri: input.schoolIdSendiri });
}
