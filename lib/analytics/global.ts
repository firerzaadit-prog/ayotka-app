import "server-only";
import { prisma } from "@/lib/db/prisma";
import { periodeBulanWIB } from "@/lib/utils/datetime";
import {
  KESIAPAN_SUBJECTS,
  ambilSkorTerbaikPerSiswaMapel,
  ringkasKesiapan,
  type KesiapanRingkasan,
} from "@/lib/analytics/kesiapan";
import { klasifikasiKesiapan, type KategoriKesiapan } from "@/lib/exam/scoring";
import { hitungPersentil, hitungRerata, hitungStandarDeviasi } from "@/lib/analytics/statistik";

export type AnalitikGlobalFilter = {
  schoolId?: string | null;
  jenjang?: "SD" | "SMP" | null;
  subjectId?: string | null;
  kompetensiId?: string | null;
  /** Bagian 5 brief menyebut filter "wilayah", tapi schools tidak punya
   * kolom wilayah/provinsi terstruktur (lihat Model Data brief Bagian 6) -
   * satu-satunya data lokasi yang ada adalah alamat bebas, jadi filter ini
   * dijalankan sebagai pencarian substring pada alamat, bukan dropdown
   * wilayah baku. */
  wilayah?: string | null;
};

/**
 * Tiket 7.1 (Bagian 5 brief, "Analitik Global"): perbandingan antar sekolah
 * + tren waktu, lintas semua sekolah aktif. Sengaja hanya mencakup siswa
 * Jalur A (terikat sekolah beneran, status aktif) - sekolah "pending" hasil
 * input manual siswa mandiri (Tiket 7.4) belum tentu entitas nyata, jadi
 * dikeluarkan supaya perbandingan tidak bias oleh data yang belum terverifikasi.
 *
 * Sengaja dua query terpisah (sekolah dulu, baru attempt-nya via
 * schoolId: {in: [...]}), bukan satu query attempt dengan filter relasi
 * bersarang student.school.{status,jenjang,alamat} - meniru persis pola
 * lib/analytics/sekolah.ts (Tiket 5.7, filter schoolId scalar langsung)
 * yang sudah terbukti jalan, dan menghindari filter relasi bersarang yang
 * belum pernah dipakai di manapun lagi di kode ini.
 */
export async function buildAnalitikGlobal(filter: AnalitikGlobalFilter) {
  const schools = await prisma.school.findMany({
    where: {
      status: "aktif",
      ...(filter.schoolId ? { id: filter.schoolId } : {}),
      ...(filter.jenjang ? { jenjang: filter.jenjang } : {}),
      ...(filter.wilayah
        ? { alamat: { contains: filter.wilayah, mode: "insensitive" as const } }
        : {}),
    },
    select: { id: true, nama: true },
  });
  const schoolNamaById = new Map(schools.map((s) => [s.id, s.nama]));
  const schoolIds = schools.map((s) => s.id);

  if (schoolIds.length === 0) {
    return { jumlahAttempt: 0, perSekolah: [], kompetensi: [], tren: [] };
  }

  const attempts = await prisma.attempt.findMany({
    where: {
      status: { in: ["selesai", "kedaluwarsa"] },
      student: { schoolId: { in: schoolIds }, deletedAt: null },
      ...(filter.subjectId ? { package: { subjectId: filter.subjectId } } : {}),
    },
    select: {
      skorAkhir: true,
      selesaiAt: true,
      mulaiAt: true,
      student: { select: { id: true, schoolId: true } },
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

  const sekolahMap = new Map<
    string,
    { nama: string; totalSkor: number; jumlahAttempt: number; siswaIds: Set<string> }
  >();
  const kompetensiMap = new Map<
    string,
    { kode: string; deskripsi: string; materi: string; jmlBenar: number; jmlSoal: number }
  >();
  const trenMap = new Map<string, { jumlahAttempt: number; totalSkor: number }>();

  for (const a of attempts) {
    const schoolId = a.student.schoolId;
    if (schoolId) {
      const existing = sekolahMap.get(schoolId) ?? {
        nama: schoolNamaById.get(schoolId) ?? "(sekolah tidak dikenal)",
        totalSkor: 0,
        jumlahAttempt: 0,
        siswaIds: new Set<string>(),
      };
      existing.siswaIds.add(a.student.id);
      if (a.skorAkhir != null) {
        existing.totalSkor += a.skorAkhir;
        existing.jumlahAttempt += 1;
      }
      sekolahMap.set(schoolId, existing);
    }

    if (a.skorAkhir != null) {
      const periode = periodeBulanWIB(a.selesaiAt ?? a.mulaiAt);
      const tren = trenMap.get(periode) ?? { jumlahAttempt: 0, totalSkor: 0 };
      tren.jumlahAttempt += 1;
      tren.totalSkor += a.skorAkhir;
      trenMap.set(periode, tren);
    }

    for (const cs of a.competencyScores) {
      if (filter.kompetensiId && cs.kompetensi.id !== filter.kompetensiId) continue;
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

  const perSekolah = Array.from(sekolahMap.entries())
    .map(([schoolId, s]) => ({
      schoolId,
      nama: s.nama,
      jumlahSiswaAktif: s.siswaIds.size,
      jumlahAttempt: s.jumlahAttempt,
      rataRata: s.jumlahAttempt > 0 ? s.totalSkor / s.jumlahAttempt : 0,
    }))
    .sort((a, b) => b.rataRata - a.rataRata);

  const kompetensi = Array.from(kompetensiMap.values())
    .map((k) => ({ ...k, persentase: k.jmlSoal > 0 ? (k.jmlBenar / k.jmlSoal) * 100 : 0 }))
    .sort((a, b) => a.persentase - b.persentase);

  const tren = Array.from(trenMap.entries())
    .map(([periode, t]) => ({
      periode,
      jumlahAttempt: t.jumlahAttempt,
      rataRata: t.jumlahAttempt > 0 ? t.totalSkor / t.jumlahAttempt : 0,
    }))
    .sort((a, b) => a.periode.localeCompare(b.periode));

  return { jumlahAttempt: attempts.length, perSekolah, kompetensi: kompetensi.slice(0, 10), tren };
}

export type StatistikMapel = {
  subjectNama: string;
  jumlahSekolah: number;
  jumlahSiswa: number;
  rerata: number;
  persentil10: number;
  median: number;
  persentil90: number;
  standarDeviasi: number;
  /** Persentase siswa per kategori (kurang+memadai+baik+istimewa = 100, atau semua 0 kalau jumlahSiswa = 0). */
  kategori: Record<KategoriKesiapan, number>;
};

function statistikMapelKosong(subjectNama: string): StatistikMapel {
  return {
    subjectNama,
    jumlahSekolah: 0,
    jumlahSiswa: 0,
    rerata: 0,
    persentil10: 0,
    median: 0,
    persentil90: 0,
    standarDeviasi: 0,
    kategori: { kurang: 0, memadai: 0, baik: 0, istimewa: 0 },
  };
}

/**
 * Statistik nasional per mata pelajaran (gaya ringkasan Kemendikdasmen):
 * jumlah sekolah/siswa, rerata, persentil 10/median/90, standar deviasi, dan
 * persentase kategori capaian - dihitung dari skor TERBAIK tiap siswa
 * (bukan tiap attempt) supaya siswa yang mengulang try out tidak menggeser
 * distribusi lewat percobaan-percobaan awalnya. Selalu mengembalikan kedua
 * mata pelajaran (KESIAPAN_SUBJECTS), sama seperti ringkasKesiapan.
 */
export async function buildStatistikMataPelajaran(
  filter: AnalitikGlobalFilter,
): Promise<StatistikMapel[]> {
  const schools = await prisma.school.findMany({
    where: {
      status: "aktif",
      ...(filter.schoolId ? { id: filter.schoolId } : {}),
      ...(filter.jenjang ? { jenjang: filter.jenjang } : {}),
      ...(filter.wilayah
        ? { alamat: { contains: filter.wilayah, mode: "insensitive" as const } }
        : {}),
    },
    select: { id: true },
  });
  if (schools.length === 0) {
    return KESIAPAN_SUBJECTS.map(statistikMapelKosong);
  }
  const schoolIds = schools.map((s) => s.id);

  const attempts = await prisma.attempt.findMany({
    where: {
      status: { in: ["selesai", "kedaluwarsa"] },
      skorAkhir: { not: null },
      student: { schoolId: { in: schoolIds }, deletedAt: null },
      package: { subject: { nama: { in: [...KESIAPAN_SUBJECTS] } } },
    },
    select: {
      studentId: true,
      skorAkhir: true,
      student: { select: { schoolId: true } },
      package: { select: { subject: { select: { nama: true } } } },
    },
  });

  const rawPerSubject = new Map<
    string,
    { studentId: string; subjectNama: string; skorAkhir: number }[]
  >();
  const sekolahPerSubject = new Map<string, Set<string>>();
  for (const a of attempts) {
    const schoolId = a.student.schoolId;
    if (a.skorAkhir == null || !schoolId) continue;
    const subjectNama = a.package.subject.nama;

    const list = rawPerSubject.get(subjectNama) ?? [];
    list.push({ studentId: a.studentId, subjectNama, skorAkhir: a.skorAkhir });
    rawPerSubject.set(subjectNama, list);

    const sekolahSet = sekolahPerSubject.get(subjectNama) ?? new Set<string>();
    sekolahSet.add(schoolId);
    sekolahPerSubject.set(subjectNama, sekolahSet);
  }

  return KESIAPAN_SUBJECTS.map((subjectNama) => {
    const bestPerSiswa = ambilSkorTerbaikPerSiswaMapel(rawPerSubject.get(subjectNama) ?? []);
    const skorTerurut = bestPerSiswa.map((b) => b.skorAkhir).sort((a, b) => a - b);
    if (skorTerurut.length === 0) return statistikMapelKosong(subjectNama);

    const kategoriList = skorTerurut
      .map((skor) => klasifikasiKesiapan(subjectNama, skor))
      .filter((k): k is KategoriKesiapan => k !== null);
    const kategoriCount = { kurang: 0, memadai: 0, baik: 0, istimewa: 0 };
    for (const k of kategoriList) kategoriCount[k] += 1;
    const totalKategori = kategoriList.length;

    return {
      subjectNama,
      jumlahSekolah: sekolahPerSubject.get(subjectNama)?.size ?? 0,
      jumlahSiswa: skorTerurut.length,
      rerata: hitungRerata(skorTerurut),
      persentil10: hitungPersentil(skorTerurut, 10),
      median: hitungPersentil(skorTerurut, 50),
      persentil90: hitungPersentil(skorTerurut, 90),
      standarDeviasi: hitungStandarDeviasi(skorTerurut),
      kategori: {
        kurang: totalKategori > 0 ? (kategoriCount.kurang / totalKategori) * 100 : 0,
        memadai: totalKategori > 0 ? (kategoriCount.memadai / totalKategori) * 100 : 0,
        baik: totalKategori > 0 ? (kategoriCount.baik / totalKategori) * 100 : 0,
        istimewa: totalKategori > 0 ? (kategoriCount.istimewa / totalKategori) * 100 : 0,
      },
    };
  });
}

export type KesiapanAntarSekolahFilter = {
  jenjang?: "SD" | "SMP" | null;
  wilayah?: string | null;
};

export type KesiapanPerSekolah = {
  schoolId: string;
  nama: string;
  jenjang: "SD" | "SMP";
} & KesiapanRingkasan;

/**
 * Kesiapan TKA lintas sekolah (dipakai admin pusat & dinas pendidikan):
 * sama persis metodenya dengan buildKesiapanSekolah (skor terbaik per
 * siswa per mapel), cuma dihitung per sekolah sekaligus dalam satu query.
 * Diurutkan dari persentase kesiapan gabungan tertinggi.
 */
export async function buildKesiapanAntarSekolah(
  filter: KesiapanAntarSekolahFilter,
): Promise<KesiapanPerSekolah[]> {
  const schools = await prisma.school.findMany({
    where: {
      status: "aktif",
      ...(filter.jenjang ? { jenjang: filter.jenjang } : {}),
      ...(filter.wilayah
        ? { alamat: { contains: filter.wilayah, mode: "insensitive" as const } }
        : {}),
    },
    select: { id: true, nama: true, jenjang: true },
  });
  if (schools.length === 0) return [];

  const schoolIds = schools.map((s) => s.id);

  const attempts = await prisma.attempt.findMany({
    where: {
      status: { in: ["selesai", "kedaluwarsa"] },
      skorAkhir: { not: null },
      student: { schoolId: { in: schoolIds }, deletedAt: null },
      package: { subject: { nama: { in: [...KESIAPAN_SUBJECTS] } } },
    },
    select: {
      studentId: true,
      skorAkhir: true,
      student: { select: { schoolId: true } },
      package: { select: { subject: { select: { nama: true } } } },
    },
  });

  const attemptsPerSchool = new Map<
    string,
    { studentId: string; subjectNama: string; skorAkhir: number }[]
  >();
  for (const a of attempts) {
    const schoolId = a.student.schoolId;
    if (!schoolId || a.skorAkhir == null) continue;
    const list = attemptsPerSchool.get(schoolId) ?? [];
    list.push({ studentId: a.studentId, subjectNama: a.package.subject.nama, skorAkhir: a.skorAkhir });
    attemptsPerSchool.set(schoolId, list);
  }

  return schools
    .map((school) => {
      const schoolAttempts = attemptsPerSchool.get(school.id) ?? [];
      const bestSkorPerSiswaMapel = ambilSkorTerbaikPerSiswaMapel(schoolAttempts);
      return {
        schoolId: school.id,
        nama: school.nama,
        jenjang: school.jenjang,
        ...ringkasKesiapan(bestSkorPerSiswaMapel),
      };
    })
    .sort((a, b) => b.gabungan.persentaseSiap - a.gabungan.persentaseSiap);
}
