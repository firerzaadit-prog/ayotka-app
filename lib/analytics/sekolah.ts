import "server-only";
import { prisma } from "@/lib/db/prisma";
import { KESIAPAN_SUBJECTS, ambilSkorTerbaikPerSiswaMapel, ringkasKesiapan } from "@/lib/analytics/kesiapan";
import { klasifikasiKesiapan, type KategoriKesiapan } from "@/lib/exam/scoring";

/**
 * Tiket 5.7/5.8: agregasi analitik admin sekolah, dipakai bersama oleh
 * halaman analitik (JSON) dan export Excel rekap - supaya angka yang
 * diunduh selalu konsisten dengan yang tampil di layar (satu sumber
 * hitungan, bukan dihitung ulang terpisah untuk tiap format output).
 */
type KompetensiAgg = { kode: string; deskripsi: string; materi: string; jmlBenar: number; jmlSoal: number };
type StudentAgg = { nama: string; nisn: string | null; totalSkor: number; jumlahAttempt: number };

function addKompetensi(
  map: Map<string, KompetensiAgg>,
  k: { id: string; kode: string; deskripsi: string; subMateri: { materi: { nama: string } } },
  jmlBenar: number,
  jmlSoal: number,
) {
  const existing = map.get(k.id) ?? {
    kode: k.kode,
    deskripsi: k.deskripsi,
    materi: k.subMateri.materi.nama,
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

export async function buildAnalitikSekolah(
  schoolId: string,
  filter: { classId?: string | null; subjectId?: string | null },
) {
  const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });

  const attempts = await prisma.attempt.findMany({
    where: {
      status: { in: ["selesai", "kedaluwarsa"] },
      student: {
        schoolId,
        deletedAt: null,
        ...(filter.classId && activeYear
          ? { enrollments: { some: { classId: filter.classId, academicYearId: activeYear.id } } }
          : {}),
      },
      ...(filter.subjectId ? { package: { subjectId: filter.subjectId } } : {}),
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
              kode: true,
              deskripsi: true,
              subMateri: { select: { materi: { select: { nama: true } } } },
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
export async function buildKesiapanSekolah(schoolId: string) {
  const attempts = await prisma.attempt.findMany({
    where: {
      status: { in: ["selesai", "kedaluwarsa"] },
      skorAkhir: { not: null },
      student: { schoolId, deletedAt: null },
      package: { subject: { nama: { in: [...KESIAPAN_SUBJECTS] } } },
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
  filter: { subjectNama: string; kategori?: KategoriKesiapan | null },
): Promise<SiswaKesiapan[]> {
  const attempts = await prisma.attempt.findMany({
    where: {
      status: { in: ["selesai", "kedaluwarsa"] },
      skorAkhir: { not: null },
      student: { schoolId, deletedAt: null },
      package: { subject: { nama: filter.subjectNama } },
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
