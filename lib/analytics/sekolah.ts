import "server-only";
import { prisma } from "@/lib/db/prisma";
import { KESIAPAN_SUBJECTS, ambilSkorTerbaikPerSiswaMapel, ringkasKesiapan } from "@/lib/analytics/kesiapan";
import { klasifikasiKesiapan, type KategoriKesiapan } from "@/lib/exam/scoring";
import { namaElemenTampil, type ElemenDenganMapel } from "@/lib/content/label-elemen";

/**
 * Tiket 5.7/5.8: agregasi analitik admin sekolah, dipakai bersama oleh
 * halaman analitik (JSON) dan export Excel rekap - supaya angka yang
 * diunduh selalu konsisten dengan yang tampil di layar (satu sumber
 * hitungan, bukan dihitung ulang terpisah untuk tiap format output).
 */
export type RentangWaktu = { dari?: Date | null; sampai?: Date | null };

/**
 * Saring percobaan menurut waktu MULAI ujian (mis. satu periode langganan). Alumni (ditandai lulus, belum dihapus)
 * tetap ikut terhitung - hanya siswa yang DIHAPUS yang keluar dari angka - sehingga data angkatan lalu tetap terlihat.
 */
export function filterMulai(rentang?: RentangWaktu | null) {
  if (!rentang || (!rentang.dari && !rentang.sampai)) return {};
  return {
    mulaiAt: {
      ...(rentang.dari ? { gte: rentang.dari } : {}),
      ...(rentang.sampai ? { lte: rentang.sampai } : {}),
    },
  };
}

type KompetensiAgg = { deskripsi: string; elemen: string; jmlBenar: number; jmlSoal: number };
type StudentAgg = { nama: string; nisn: string | null; totalSkor: number; jumlahAttempt: number };

function addKompetensi(
  map: Map<string, KompetensiAgg>,
  k: { id: string; deskripsi: string; elemen: ElemenDenganMapel },
  jmlBenar: number,
  jmlSoal: number,
) {
  const existing = map.get(k.id) ?? {
    deskripsi: k.deskripsi,
    elemen: namaElemenTampil(k.elemen),
    jmlBenar: 0,
    jmlSoal: 0,
  };
  existing.jmlBenar += jmlBenar;
  existing.jmlSoal += jmlSoal;
  map.set(k.id, existing);
}

function addSkor(
  map: Map<string, StudentAgg>,
  student: { id: string; nama: string; nisn: string | null },
  skor: number,
) {
  const existing = map.get(student.id) ?? {
    nama: student.nama,
    nisn: student.nisn,
    totalSkor: 0,
    jumlahAttempt: 0,
  };
  existing.totalSkor += skor;
  existing.jumlahAttempt += 1;
  map.set(student.id, existing);
}

function toKompetensiList(map: Map<string, KompetensiAgg>) {
  return Array.from(map.values())
    .map((k) => ({ ...k, persentase: k.jmlSoal > 0 ? (k.jmlBenar / k.jmlSoal) * 100 : 0 }))
    .sort((a, b) => a.persentase - b.persentase);
}

function toRankingList(map: Map<string, StudentAgg>) {
  return Array.from(map.entries())
    .map(([studentId, s]) => ({
      studentId,
      nama: s.nama,
      nisn: s.nisn,
      rataRata: s.totalSkor / s.jumlahAttempt,
      jumlahAttempt: s.jumlahAttempt,
    }))
    .sort((a, b) => b.rataRata - a.rataRata);
}

import type { Prisma } from "@prisma/client";

export type FilterKategoriUjian = "semua" | "sekolah" | "nasional" | "mandiri";

export function filterKategoriUjianToWhere(kat?: FilterKategoriUjian | null): Prisma.PackageWhereInput {
  if (!kat || kat === "semua") return {};
  if (kat === "sekolah") return { ownerType: "sekolah" };
  if (kat === "nasional") return { ownerType: "pusat", kategori: "nasional" };
  if (kat === "mandiri") return { ownerType: "pusat", kategori: "mandiri" };
  return {};
}

export async function buildAnalitikSekolah(
  schoolId: string,
  filter: { subjectId?: string | null; kategoriUjian?: FilterKategoriUjian | null } & RentangWaktu,
) {
  const attempts = await prisma.attempt.findMany({
    where: {
      status: { in: ["selesai", "kedaluwarsa"] },
      student: { schoolId, jalur: "A", deletedAt: null },
      package: {
        ...(filter.subjectId ? { subjectId: filter.subjectId } : {}),
        ...filterKategoriUjianToWhere(filter.kategoriUjian),
      },
      ...filterMulai(filter),
    },
    select: {
      id: true,
      skorAkhir: true,
      student: { select: { id: true, nama: true, nisn: true } },
      package: { select: { subjectId: true, subject: { select: { nama: true } } } },
      competencyScores: {
        select: {
          jmlBenar: true,
          jmlSoal: true,
          kompetensi: {
            select: {
              id: true,
              deskripsi: true,
              elemen: { select: { nama: true, subject: { select: { nama: true, jenjang: true } } } },
            },
          },
        },
      },
    },
  });

  const kompetensiMap = new Map<string, KompetensiAgg>();
  const studentMap = new Map<string, StudentAgg>();

  // Rincian yang sama, dikelompokkan lagi per mapel - satu lintasan data yang
  // sama dipakai untuk gabungan MAUPUN per mapel, supaya keduanya selalu
  // konsisten (bukan dua query/reduksi terpisah yang bisa diam-diam beda).
  const perMapelAcc = new Map<
    string,
    { subjectNama: string; kompetensi: Map<string, KompetensiAgg>; ranking: Map<string, StudentAgg> }
  >();

  for (const a of attempts) {
    const subjectId = a.package.subjectId;
    const bucket = perMapelAcc.get(subjectId) ?? {
      subjectNama: a.package.subject.nama,
      kompetensi: new Map<string, KompetensiAgg>(),
      ranking: new Map<string, StudentAgg>(),
    };
    perMapelAcc.set(subjectId, bucket);

    if (a.skorAkhir != null) {
      addSkor(studentMap, a.student, a.skorAkhir);
      addSkor(bucket.ranking, a.student, a.skorAkhir);
    }

    for (const cs of a.competencyScores) {
      addKompetensi(kompetensiMap, cs.kompetensi, cs.jmlBenar, cs.jmlSoal);
      addKompetensi(bucket.kompetensi, cs.kompetensi, cs.jmlBenar, cs.jmlSoal);
    }
  }

  const kompetensi = toKompetensiList(kompetensiMap);
  const ranking = toRankingList(studentMap);

  const perMapel = Array.from(perMapelAcc.entries())
    .map(([subjectId, bucket]) => ({
      subjectId,
      subjectNama: bucket.subjectNama,
      kompetensi: toKompetensiList(bucket.kompetensi),
      ranking: toRankingList(bucket.ranking),
    }))
    .sort((a, b) => a.subjectNama.localeCompare(b.subjectNama));

  return { jumlahAttempt: attempts.length, kompetensi, ranking, perMapel };
}

/**
 * Kesiapan TKA 1 sekolah: gabungan (Matematika + Bahasa Indonesia dicampur)
 * + rincian per mapel, berdasarkan skor TERBAIK tiap siswa (bukan attempt
 * terakhir/rata-rata - siswa yang sudah 3x try out dinilai dari usaha
 * terbaiknya). Kategori & angka batas: lihat lib/exam/scoring.ts.
 */
export async function buildKesiapanSekolah(
  schoolId: string,
  filter?: RentangWaktu & { kategoriUjian?: FilterKategoriUjian | null } | null,
) {
  const attempts = await prisma.attempt.findMany({
    where: {
      status: { in: ["selesai", "kedaluwarsa"] },
      skorAkhir: { not: null },
      student: { schoolId, jalur: "A", deletedAt: null },
      package: { 
        subject: { nama: { in: [...KESIAPAN_SUBJECTS] } },
        ...filterKategoriUjianToWhere(filter?.kategoriUjian)
      },
      ...filterMulai(filter),
    },
    select: {
      studentId: true,
      skorAkhir: true,
      package: { select: { subject: { select: { nama: true } } } },
    },
  });

  const bestSkorPerSiswaMapel = ambilSkorTerbaikPerSiswaMapel(
    attempts
      .filter((a): a is typeof a & { skorAkhir: number } => a.skorAkhir != null)
      .map((a) => ({
        studentId: a.studentId,
        subjectNama: a.package.subject.nama,
        skorAkhir: a.skorAkhir,
      })),
  );

  return ringkasKesiapan(bestSkorPerSiswaMapel);
}

export type SiswaKesiapan = {
  studentId: string;
  nama: string;
  nisn: string | null;
  skorAkhir: number;
  kategori: KategoriKesiapan;
};

/**
 * Daftar siswa 1 sekolah untuk SATU mata pelajaran Kesiapan TKA, berdasarkan
 * skor TERBAIK tiap siswa (konsisten dengan buildKesiapanSekolah di atas) -
 * dipakai untuk drill-down dari kartu kesiapan (agregat) ke daftar siswa per
 * kategori, bukan reduksi baru yang terpisah dari sumber hitungan yang sama.
 */
export async function buildDaftarSiswaKesiapanSekolah(
  schoolId: string,
  filter: { subjectNama: string; kategori?: KategoriKesiapan | null; kategoriUjian?: FilterKategoriUjian | null } & RentangWaktu,
): Promise<SiswaKesiapan[]> {
  const attempts = await prisma.attempt.findMany({
    where: {
      status: { in: ["selesai", "kedaluwarsa"] },
      skorAkhir: { not: null },
      student: { schoolId, jalur: "A", deletedAt: null },
      package: { 
        subject: { nama: filter.subjectNama },
        ...filterKategoriUjianToWhere(filter.kategoriUjian)
      },
      ...filterMulai(filter),
    },
    select: {
      studentId: true,
      skorAkhir: true,
      student: { select: { nama: true, nisn: true } },
    },
  });

  const bestSkorPerSiswa = ambilSkorTerbaikPerSiswaMapel(
    attempts
      .filter((a): a is typeof a & { skorAkhir: number } => a.skorAkhir != null)
      .map((a) => ({
        studentId: a.studentId,
        subjectNama: filter.subjectNama,
        skorAkhir: a.skorAkhir,
        nama: a.student.nama,
        nisn: a.student.nisn,
      })),
  );

  return bestSkorPerSiswa
    .map((s) => ({
      studentId: s.studentId,
      nama: s.nama,
      nisn: s.nisn,
      skorAkhir: s.skorAkhir,
      kategori: klasifikasiKesiapan(filter.subjectNama, s.skorAkhir),
    }))
    .filter((s): s is SiswaKesiapan => s.kategori !== null)
    .filter((s) => !filter.kategori || s.kategori === filter.kategori)
    .sort((a, b) => a.skorAkhir - b.skorAkhir);
}
