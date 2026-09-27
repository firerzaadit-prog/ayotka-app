import "server-only";
import { prisma } from "@/lib/db/prisma";

/**
 * Ambil kabupatenKota milik akun dinas pendidikan yang sedang login.
 * Dipakai semua API endpoint /api/dinas-pendidikan/* untuk membatasi
 * data sekolah yang boleh dilihat. Mengembalikan null jika profil dinas
 * belum dibuat (admin pusat belum menyetel wilayah).
 */
export async function getDinasWilayah(
  userId: string,
): Promise<string | null> {
  const dinas = await prisma.dinasAdmin.findUnique({
    where: { userId },
    select: { kabupatenKota: true },
  });
  return dinas?.kabupatenKota ?? null;
}

/**
 * Ambil profil lengkap akun dinas pendidikan.
 */
export async function getDinasProfile(userId: string) {
  return prisma.dinasAdmin.findUnique({
    where: { userId },
    select: {
      id: true,
      nama: true,
      instansi: true,
      kabupatenKota: true,
    },
  });
}
