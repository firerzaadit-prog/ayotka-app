import "server-only";
import { NextResponse } from "next/server";
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

export type CakupanDinas = { kabupatenKota: string | null } | { galat: NextResponse };

/**
 * Cakupan data untuk API yang boleh dipakai admin pusat DAN dinas pendidikan: admin pusat tidak dibatasi
 * (kabupatenKota null = semua wilayah), dinas pendidikan dibatasi ke wilayahnya.
 *
 * GAGAL TERTUTUP: akun dinas yang wilayahnya tidak ada (profil dinas belum dibuat) ditolak 403, BUKAN dianggap
 * "semua wilayah". Sebelumnya wilayah null diteruskan apa adanya ke filter query, yang berarti tidak menyaring
 * apa pun dan akun dinas seperti itu melihat data semua kota/kabupaten.
 */
export async function bacaCakupanDinas(user: { id: string; role: string }): Promise<CakupanDinas> {
  if (user.role !== "dinas_pendidikan") return { kabupatenKota: null };
  const kabupatenKota = await getDinasWilayah(user.id);
  if (!kabupatenKota) {
    return {
      galat: NextResponse.json(
        { error: "Wilayah akun dinas belum diatur. Hubungi admin pusat untuk menetapkan kota/kabupaten." },
        { status: 403 },
      ),
    };
  }
  return { kabupatenKota };
}

type SiswaUntukCakupan = {
  jalur: string;
  deletedAt: Date | null;
  school: { kabupatenKota: string | null } | null;
};

/**
 * Apakah satu siswa boleh dilihat akun dinas dengan wilayah `kabupatenKota`. Sama dengan cakupan daftar/analitik
 * dinas: siswa Jalur A (terikat sekolah), belum dihapus, dan sekolahnya berada di wilayah itu. Siswa mandiri
 * (Jalur B) TIDAK termasuk walau mencatat sekolah asal - itu isian bebas siswa, bukan keterikatan sekolah, dan
 * sekolah/dinas tidak berhak atas riwayatnya. Wilayah kosong = tidak boleh melihat siapa pun (gagal tertutup).
 */
export function siswaDalamWilayahDinas(siswa: SiswaUntukCakupan, kabupatenKota: string | null): boolean {
  return (
    !!kabupatenKota &&
    siswa.jalur === "A" &&
    siswa.deletedAt === null &&
    siswa.school?.kabupatenKota === kabupatenKota
  );
}
