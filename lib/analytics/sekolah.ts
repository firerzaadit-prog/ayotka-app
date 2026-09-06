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

  const kompetensiMap = new Map<
    string,
    { kode: string; deskripsi: string; materi: string; jmlBenar: number; jmlSoal: number }
  >();
  const studentMap = new Map<
    string,
    { nama: string; nisn: string | null; totalSkor: number; jumlahAttempt: number }
  >();

  for (const a of attempts) {
    if (a.skorAkhir != null) {
      const existing = studentMap.get(a.student.id) ?? {
        nama: a.student.nama,
        nisn: a.student.nisn,
        totalSkor: 0,
        jumlahAttempt: 0,
      };
      existing.totalSkor += a.skorAkhir;
      existing.jumlahAttempt += 1;
      studentMap.set(a.student.id, existing);
    }

    for (const cs of a.competencyScores) {
      const k = cs.kompetensi;
      const existing = kompetensiMap.get(k.id) ?? {
        kode: k.kode,
        deskripsi: k.deskripsi,
        materi: k.subMateri.materi.nama,
        jmlBenar: 0,
        jmlSoal: 0,
      };
      existing.jmlBenar += cs.jmlBenar;
      existing.jmlSoal += cs.jmlSoal;
      kompetensiMap.set(k.id, existing);
    }
  }

  const kompetensi = Array.from(kompetensiMap.values())
    .map((k) => ({ ...k, persentase: k.jmlSoal > 0 ? (k.jmlBenar / k.jmlSoal) * 100 : 0 }))
    .sort((a, b) => a.persentase - b.persentase);

  const ranking = Array.from(studentMap.entries())
    .map(([studentId, s]) => ({
      studentId,
      nama: s.nama,
      nisn: s.nisn,
      rataRata: s.totalSkor / s.jumlahAttempt,
      jumlahAttempt: s.jumlahAttempt,
    }))
    .sort((a, b) => b.rataRata - a.rataRata);

  return { jumlahAttempt: attempts.length, kompetensi, ranking };
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
