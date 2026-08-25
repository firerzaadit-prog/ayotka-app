import "server-only";
import { prisma } from "@/lib/db/prisma";
import { periodeBulanWIB } from "@/lib/utils/datetime";

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
 */
export async function buildAnalitikGlobal(filter: AnalitikGlobalFilter) {
  const attempts = await prisma.attempt.findMany({
    where: {
      status: { in: ["selesai", "kedaluwarsa"] },
      student: {
        deletedAt: null,
        school: {
          status: "aktif",
          ...(filter.schoolId ? { id: filter.schoolId } : {}),
          ...(filter.jenjang ? { jenjang: filter.jenjang } : {}),
          ...(filter.wilayah
            ? { alamat: { contains: filter.wilayah, mode: "insensitive" as const } }
            : {}),
        },
      },
      ...(filter.subjectId ? { package: { subjectId: filter.subjectId } } : {}),
    },
    select: {
      skorAkhir: true,
      selesaiAt: true,
      mulaiAt: true,
      student: { select: { id: true, schoolId: true, school: { select: { nama: true } } } },
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
        nama: a.student.school!.nama,
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
