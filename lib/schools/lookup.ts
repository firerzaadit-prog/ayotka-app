import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { School } from "@prisma/client";
import { isSchoolActive } from "@/lib/schools/active";

/**
 * Tiket 3.2 (Bagian 3.1 brief): validasi kode sekolah - dipakai di dua
 * endpoint publik (cek kode & cari nama). cari-siswa WAJIB memanggil ulang
 * fungsi ini setiap request, bukan mempercayai hasil cek-kode-sekolah
 * sebelumnya, supaya endpoint pencarian nama tidak pernah bisa diakses
 * tanpa kode sekolah yang valid (lihat catatan keamanan Bagian 3.1 & 10 brief).
 */
export async function findActiveSchoolByCode(kodeSekolah: string): Promise<School | null> {
  const school = await prisma.school.findUnique({ where: { kodeSekolah } });
  if (!school || !isSchoolActive(school)) return null;
  return school;
}
