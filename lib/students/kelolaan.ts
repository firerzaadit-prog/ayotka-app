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

/** Siswa kelolaan `id` bagi `user`, atau null (tidak ada / bukan Jalur A / sudah dihapus / sekolah lain). */
export async function loadSiswaKelolaan(user: CurrentUser, id: string): Promise<Student | null> {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student || !bisaDikelolaAdmin(student)) return null;
  const allowedSchoolId = await resolveSchoolId(user, student.schoolId);
  return allowedSchoolId === student.schoolId ? student : null;
}
