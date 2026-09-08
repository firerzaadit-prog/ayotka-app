import { klasifikasiKesiapan, type KategoriKesiapan } from "@/lib/exam/scoring";

/**
 * Mata pelajaran yang dicakup fitur Kesiapan TKA - dipakai SERAGAM di semua
 * tampilan (dashboard/analitik admin sekolah, dashboard & Analitik Global
 * dinas pendidikan, Analitik Global admin pusat) supaya cakupan mata
 * pelajarannya selalu sama di seluruh sistem, bukan beda-beda per role.
 * Matematika & Bahasa Indonesia adalah mapel resmi TKA; IPA & Bahasa Inggris
 * ikut disertakan atas permintaan pemilik produk memakai standar kategori
 * Bahasa Indonesia SMP (lihat KESIAPAN_THRESHOLDS di lib/exam/scoring.ts).
 */
export const KESIAPAN_SUBJECTS = [
  "Matematika",
  "Bahasa Indonesia",
  "Bahasa Inggris",
  "IPA",
] as const;

export const KATEGORI_LABEL: Record<KategoriKesiapan, string> = {
  kurang: "Kurang",
  memadai: "Memadai",
  baik: "Baik",
  istimewa: "Istimewa",
};

export const KATEGORI_BADGE_VARIANT: Record<KategoriKesiapan, "danger" | "warning" | "success" | "info"> = {
  kurang: "danger",
  memadai: "warning",
  baik: "success",
  istimewa: "info",
};

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
  // bersandar pada klasifikasiKesiapan mengembalikan null - KESIAPAN_THRESHOLDS
  // di lib/exam/scoring.ts bisa saja suatu saat nambah mapel baru duluan
  // sebelum KESIAPAN_SUBJECTS ikut diperbarui, jadi filter eksplisit ini
  // mencegah mapel itu diam-diam ikut masuk hitungan sebelum sengaja
  // ditambahkan ke KESIAPAN_SUBJECTS juga.
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
 * Reduksi umum: dari daftar attempt (skorAkhir + studentId + subjectNama,
 * boleh bawa field tambahan seperti nama/nisn/schoolId), ambil attempt
 * dengan skor TERBAIK per (studentId, subjectNama) - generic supaya field
 * tambahan itu ikut terbawa, bukan cuma {subjectNama, skorAkhir}, karena
 * daftar siswa per kategori kesiapan butuh identitas siswanya. Dipakai
 * sebelum ringkasKesiapan - dipisah supaya query Prisma (beda bentuk untuk
 * 1 sekolah vs banyak sekolah) tetap terpisah dari reduksi murninya.
 */
export function ambilSkorTerbaikPerSiswaMapel<
  T extends { studentId: string; subjectNama: string; skorAkhir: number },
>(attempts: T[]): T[] {
  const bestPerStudent = new Map<string, Map<string, T>>();
  for (const a of attempts) {
    const perStudent = bestPerStudent.get(a.studentId) ?? new Map<string, T>();
    const current = perStudent.get(a.subjectNama);
    if (current === undefined || a.skorAkhir > current.skorAkhir) {
      perStudent.set(a.subjectNama, a);
    }
    bestPerStudent.set(a.studentId, perStudent);
  }

  return Array.from(bestPerStudent.values()).flatMap((perStudent) =>
    Array.from(perStudent.values()),
  );
}

export type KesiapanSiswaPerMapel = {
  subjectNama: string;
  skorTerbaik: number | null;
  kategori: KategoriKesiapan | null;
};

/**
 * Kesiapan SATU siswa, dipecah per mata pelajaran (skor TERBAIK dari semua
 * attempt-nya di mapel itu + kategori) - dipakai halaman detail riwayat
 * siswa (admin sekolah/admin pusat/dinas pendidikan) supaya kategori resmi
 * per mapel tampil berdampingan dengan riwayat attempt individualnya,
 * memakai sumber hitungan (skor terbaik) yang sama persis dengan
 * ringkasKesiapan/buildDaftarSiswaKesiapan* di atas - bukan reduksi baru.
 * Selalu mengembalikan semua KESIAPAN_SUBJECTS (skorTerbaik/kategori null
 * kalau siswa belum pernah mengerjakan mapel itu).
 */
export function ringkasKesiapanSiswa(
  skorPerMapel: { subjectNama: string; skorAkhir: number }[],
): KesiapanSiswaPerMapel[] {
  const kesiapanSubjectNames: readonly string[] = KESIAPAN_SUBJECTS;
  const bestPerMapel = new Map<string, number>();
  for (const s of skorPerMapel) {
    if (!kesiapanSubjectNames.includes(s.subjectNama)) continue;
    const current = bestPerMapel.get(s.subjectNama);
    if (current === undefined || s.skorAkhir > current) {
      bestPerMapel.set(s.subjectNama, s.skorAkhir);
    }
  }

  return KESIAPAN_SUBJECTS.map((subjectNama) => {
    const skorTerbaik = bestPerMapel.get(subjectNama) ?? null;
    return {
      subjectNama,
      skorTerbaik,
      kategori: skorTerbaik !== null ? klasifikasiKesiapan(subjectNama, skorTerbaik) : null,
    };
  });
}
