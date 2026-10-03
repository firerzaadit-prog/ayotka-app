import "server-only";
import type { Student } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CurrentUser } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";

/**
 * Siswa yang boleh dikelola admin lewat rute /api/admin-sekolah/siswa/**: HANYA siswa Jalur A
 * (didaftarkan sekolah), terikat sekolah, dan belum dihapus. Siswa mandiri (Jalur B) juga bisa
 * punya schoolId (sekolah asal yang dipilihnya saat daftar), tetapi mereka pelanggan sendiri:
 * admin sekolah tidak boleh menghapus, mengubah, atau mereset kata sandi akun mereka.
 *
 * Satu fungsi ini dipakai SEMUA rute kelola-siswa (ubah, hapus, reset sandi, reset kode klaim)
 * supaya aturan kepemilikan tidak bisa menyimpang antar rute.
 */
export function bisaDikelolaAdmin(student: Pick<Student, "jalur" | "schoolId" | "deletedAt">): boolean {
  return student.jalur === "A" && student.schoolId != null && student.deletedAt == null;
}

/**
 * Versi massal loadSiswaKelolaan untuk aksi banyak siswa sekaligus (hapus massal, tandai lulus): hanya siswa Jalur A
 * yang belum dihapus dan terikat sekolah yang DICARI (filter ada di query), lalu otorisasi dicek SEKALI per sekolah.
 * `tidakDitemukan` = jumlah ID yang tidak diproses (tidak ada, sudah dihapus, Jalur B, atau milik sekolah lain).
 */
export async function muatSiswaKelolaanMassal(
  user: CurrentUser,
  ids: string[],
): Promise<{ boleh: Student[]; tidakDitemukan: number }> {
  const ditemukan = await prisma.student.findMany({
    where: { id: { in: ids }, jalur: "A", deletedAt: null, schoolId: { not: null } },
  });
  const izinSekolah = new Map<string, boolean>();
  for (const schoolId of new Set(ditemukan.map((s) => s.schoolId!))) {
    izinSekolah.set(schoolId, (await resolveSchoolId(user, schoolId)) === schoolId);
  }
  const boleh = ditemukan.filter((s) => izinSekolah.get(s.schoolId!) === true);
  return { boleh, tidakDitemukan: ids.length - boleh.length };
}

/** Siswa kelolaan `id` bagi `user`, atau null (tidak ada / bukan Jalur A / sudah dihapus / sekolah lain). */
export async function loadSiswaKelolaan(user: CurrentUser, id: string): Promise<Student | null> {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student || !bisaDikelolaAdmin(student)) return null;
  const allowedSchoolId = await resolveSchoolId(user, student.schoolId);
  return allowedSchoolId === student.schoolId ? student : null;
}
