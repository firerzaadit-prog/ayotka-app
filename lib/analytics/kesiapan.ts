import { klasifikasiKesiapan, type KategoriKesiapan } from "@/lib/exam/scoring";

/** Mata pelajaran yang punya kategori kesiapan resmi - lihat lib/exam/scoring.ts. */
export const KESIAPAN_SUBJECTS = ["Matematika", "Bahasa Indonesia"] as const;

export type KesiapanBreakdown = {
  kurang: number;
  memadai: number;
  baik: number;
  istimewa: number;
  total: number;
  /** (memadai + baik + istimewa) / total * 100 - 0 kalau belum ada data. */
  persentaseSiap: number;
};

export type KesiapanRingkasan = {
  gabungan: KesiapanBreakdown;
  perMapel: { subjectNama: string; breakdown: KesiapanBreakdown }[];
};

function buildBreakdown(kategoriList: KategoriKesiapan[]): KesiapanBreakdown {
  const counts = { kurang: 0, memadai: 0, baik: 0, istimewa: 0 };
  for (const k of kategoriList) counts[k] += 1;
  const total = kategoriList.length;
  const siap = counts.memadai + counts.baik + counts.istimewa;
  return { ...counts, total, persentaseSiap: total > 0 ? (siap / total) * 100 : 0 };
}

/**
 * Rangkum skor TERBAIK tiap (siswa, mapel) jadi kesiapan gabungan (kedua
 * mapel dicampur jadi satu kumpulan) + rincian per mapel - dipakai bareng
 * oleh kesiapan 1 sekolah (admin sekolah) dan kesiapan lintas sekolah
 * (admin pusat/dinas pendidikan, dipanggil sekali per sekolah).
 */
export function ringkasKesiapan(
  bestSkorPerSiswaMapel: { subjectNama: string; skorAkhir: number }[],
): KesiapanRingkasan {
  // Filter keanggotaan KESIAPAN_SUBJECTS dicek sendiri di sini, TIDAK cuma
  // bersandar pada klasifikasiKesiapan mengembalikan null - klasifikasiKesiapan
  // sekarang juga mendukung IPA/Bahasa Inggris utk keperluan lain (statistik
  // nasional Analitik Global, lihat lib/analytics/global.ts), jadi fitur
  // Kesiapan TKA yang lebih sempit ini (cuma Matematika & Bahasa Indonesia)
  // harus tetap menyaring sendiri supaya tidak diam-diam ikut mencakup mapel
  // lain kalau suatu saat dipanggil dengan data campuran.
  const kesiapanSubjectNames: readonly string[] = KESIAPAN_SUBJECTS;
  const classified = bestSkorPerSiswaMapel
    .filter((s) => kesiapanSubjectNames.includes(s.subjectNama))
    .map(({ subjectNama, skorAkhir }) => ({
      subjectNama,
      kategori: klasifikasiKesiapan(subjectNama, skorAkhir),
    }))
    .filter((c): c is { subjectNama: string; kategori: KategoriKesiapan } => c.kategori !== null);

  const gabungan = buildBreakdown(classified.map((c) => c.kategori));
  const perMapel = KESIAPAN_SUBJECTS.map((subjectNama) => ({
    subjectNama,
    breakdown: buildBreakdown(
      classified.filter((c) => c.subjectNama === subjectNama).map((c) => c.kategori),
    ),
  }));

  return { gabungan, perMapel };
}

/**
 * Reduksi umum: dari daftar attempt (skorAkhir + studentId + subjectNama),
 * ambil skor TERBAIK per (studentId, subjectNama). Dipakai sebelum
 * ringkasKesiapan - dipisah supaya query Prisma (beda bentuk untuk 1
 * sekolah vs banyak sekolah) tetap terpisah dari reduksi murninya.
 */
export function ambilSkorTerbaikPerSiswaMapel(
  attempts: { studentId: string; subjectNama: string; skorAkhir: number }[],
): { subjectNama: string; skorAkhir: number }[] {
  const bestPerStudent = new Map<string, Map<string, number>>();
  for (const a of attempts) {
    const perStudent = bestPerStudent.get(a.studentId) ?? new Map<string, number>();
    const current = perStudent.get(a.subjectNama);
    if (current === undefined || a.skorAkhir > current) {
      perStudent.set(a.subjectNama, a.skorAkhir);
    }
    bestPerStudent.set(a.studentId, perStudent);
  }

  return Array.from(bestPerStudent.values()).flatMap((perStudent) =>
    Array.from(perStudent.entries()).map(([subjectNama, skorAkhir]) => ({ subjectNama, skorAkhir })),
  );
}
