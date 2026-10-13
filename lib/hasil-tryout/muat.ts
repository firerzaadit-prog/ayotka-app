import "server-only";
import type { Jenjang } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { wherePaketTersedia } from "@/lib/exam/paket-tersedia";
import {
  STATUS_PERCOBAAN_SELESAI,
  susunHasilTryOut,
  type HasilTryOut,
  type PaketInfo,
  type SiswaInfo,
} from "@/lib/hasil-tryout/susun";

/**
 * Pemuat data laporan hasil try out untuk admin sekolah. Hanya membaca. Cakupan siswa SELALU sama dengan aturan kelola siswa
 * (lib/students/kelolaan.ts bisaDikelolaAdmin): Jalur A, milik sekolah ini, belum dihapus. Siswa mandiri (Jalur B) yang
 * kebetulan memilih sekolah ini dan siswa arsip tidak pernah ikut. Alumni (sudah lulus, belum dihapus) tetap ikut: nilai
 * angkatan lalu tetap terlihat; halaman yang tidak menginginkannya menyaringnya lewat `alumni: "tanpa"`.
 *
 * Pemanggil bertanggung jawab atas otorisasi dan menentukan `schoolId` (resolveSchoolId); fungsi di sini mempercayainya.
 */
const siswaSekolah = (schoolId: string) => ({ schoolId, jalur: "A" as const, deletedAt: null });

/** Hasil resmi semua try out siswa sekolah ini (opsional dibatasi ke satu paket). */
export async function muatHasilSekolah(schoolId: string, opsi: { paketId?: string | null } = {}): Promise<HasilTryOut[]> {
  const percobaan = await prisma.attempt.findMany({
    where: {
      status: { in: [...STATUS_PERCOBAAN_SELESAI] },
      student: siswaSekolah(schoolId),
      ...(opsi.paketId ? { packageId: opsi.paketId } : {}),
    },
    select: {
      id: true,
      studentId: true,
      packageId: true,
      assignmentId: true,
      status: true,
      skorAkhir: true,
      mulaiAt: true,
      selesaiAt: true,
      student: { select: { id: true, nama: true, nisn: true, claimStatus: true, lulusAt: true } },
      package: {
        select: { id: true, nama: true, kategori: true, ownerType: true, jenjang: true, subjectId: true, subject: { select: { nama: true } } },
      },
    },
  });

  const siswa = new Map<string, SiswaInfo>();
  const paket = new Map<string, PaketInfo>();
  for (const p of percobaan) {
    siswa.set(p.student.id, p.student);
    paket.set(p.package.id, {
      id: p.package.id,
      nama: p.package.nama,
      kategori: p.package.kategori,
      ownerType: p.package.ownerType,
      jenjang: p.package.jenjang,
      subjectId: p.package.subjectId,
      mapel: p.package.subject.nama,
    });
  }
  return susunHasilTryOut(
    percobaan.map((p) => ({
      id: p.id,
      studentId: p.studentId,
      packageId: p.packageId,
      assignmentId: p.assignmentId,
      status: p.status,
      skorAkhir: p.skorAkhir,
      mulaiAt: p.mulaiAt,
      selesaiAt: p.selesaiAt,
    })),
    siswa,
    paket,
  );
}

/** Jumlah siswa AKTIF (belum lulus) sekolah ini per jenjang: pembagi partisipasi tiap paket. */
export async function hitungSiswaAktifPerJenjang(schoolId: string): Promise<Record<string, number>> {
  const baris = await prisma.student.groupBy({
    by: ["jenjang"],
    where: { ...siswaSekolah(schoolId), lulusAt: null },
    _count: { _all: true },
  });
  return Object.fromEntries(baris.map((b) => [b.jenjang, b._count._all]));
}

export type PaketLaporan = Omit<PaketInfo, "jenjang"> & { jenjang: Jenjang; jumlahSoal: number; durasiMenit: number };

/**
 * Paket yang boleh dilihat performanya oleh sekolah ini: yang sudah dikerjakan siswa sekolah ini, atau yang tersedia untuk
 * sekolah (terbit, untuk siswa sekolah, milik pusat; nasional ikut). Paket lain (mis. konsep yang belum terbit) -> null.
 */
export async function muatPaketLaporan(schoolId: string, packageId: string): Promise<PaketLaporan | null> {
  const p = await prisma.package.findFirst({
    where: {
      id: packageId,
      OR: [{ attempts: { some: { student: siswaSekolah(schoolId) } } }, wherePaketTersedia(schoolId, { termasukNasional: true })],
    },
    select: {
      id: true,
      nama: true,
      kategori: true,
      ownerType: true,
      jenjang: true,
      subjectId: true,
      jumlahSoal: true,
      durasiMenit: true,
      subject: { select: { nama: true } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    nama: p.nama,
    kategori: p.kategori,
    ownerType: p.ownerType,
    jenjang: p.jenjang,
    subjectId: p.subjectId,
    mapel: p.subject.nama,
    jumlahSoal: p.jumlahSoal,
    durasiMenit: p.durasiMenit,
  };
}

/** Siswa aktif sekolah ini yang jenjangnya sama dengan paket: yang BOLEH mengerjakannya (daftar "belum mengerjakan"). */
export async function muatSiswaAktifJenjang(schoolId: string, jenjang: Jenjang): Promise<SiswaInfo[]> {
  return prisma.student.findMany({
    where: { ...siswaSekolah(schoolId), lulusAt: null, jenjang },
    select: { id: true, nama: true, nisn: true, claimStatus: true, lulusAt: true },
  });
}

/** Id siswa sekolah ini yang punya percobaan berjalan atau dijeda pada paket ini. */
export async function muatSedangMengerjakan(schoolId: string, packageId: string): Promise<Set<string>> {
  const baris = await prisma.attempt.findMany({
    where: { packageId, status: { in: ["berjalan", "paused"] }, student: siswaSekolah(schoolId) },
    select: { studentId: true },
    distinct: ["studentId"],
  });
  return new Set(baris.map((b) => b.studentId));
}
