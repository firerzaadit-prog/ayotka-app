import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { provinsiDariKabupatenKota } from "@/lib/wilayah";
import {
  bacaPermintaanFilterWilayah,
  gabungkanFilterWilayah,
  sekolahDalamCakupan,
  type CakupanWilayah,
  type FilterWilayah,
  type SekolahBerwilayah,
} from "@/lib/wilayah/cakupan";

/**
 * Wilayah cakupan akun dinas pendidikan yang sedang login. Dinas kota/kabupaten: provinsi + kabupatenKota. Dinas
 * provinsi: hanya provinsi (semua kota/kabupaten di provinsi itu). Provinsi diturunkan dari kota/kabupaten bila
 * kolomnya kosong. Mengembalikan null bila profil dinas belum dibuat atau wilayahnya belum diatur - pemanggil WAJIB
 * memperlakukannya sebagai "tidak boleh melihat apa pun", bukan "semua wilayah".
 */
export async function getDinasWilayah(userId: string): Promise<CakupanWilayah | null> {
  const dinas = await prisma.dinasAdmin.findUnique({
    where: { userId },
    select: { provinsi: true, kabupatenKota: true },
  });
  if (!dinas) return null;
  const kabupatenKota = dinas.kabupatenKota?.trim() || null;
  const provinsi = dinas.provinsi?.trim() || provinsiDariKabupatenKota(kabupatenKota);
  if (!kabupatenKota && !provinsi) return null;
  return { provinsi, kabupatenKota };
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
      provinsi: true,
      kabupatenKota: true,
    },
  });
}

export type CakupanDinas = CakupanWilayah | { galat: NextResponse };

/**
 * Cakupan data untuk API yang boleh dipakai admin pusat DAN dinas pendidikan: admin pusat tidak dibatasi
 * (provinsi dan kabupatenKota null = semua wilayah), dinas pendidikan dibatasi ke wilayahnya.
 *
 * GAGAL TERTUTUP: akun dinas yang wilayahnya tidak ada (profil dinas belum dibuat) ditolak 403, BUKAN dianggap
 * "semua wilayah". Sebelumnya wilayah null diteruskan apa adanya ke filter query, yang berarti tidak menyaring
 * apa pun dan akun dinas seperti itu melihat data semua kota/kabupaten.
 */
export async function bacaCakupanDinas(user: { id: string; role: string }): Promise<CakupanDinas> {
  if (user.role !== "dinas_pendidikan") return { provinsi: null, kabupatenKota: null };
  const wilayah = await getDinasWilayah(user.id);
  if (!wilayah) {
    return {
      galat: NextResponse.json(
        { error: "Wilayah akun dinas belum diatur. Hubungi admin pusat untuk menetapkan provinsi atau kota/kabupaten." },
        { status: 403 },
      ),
    };
  }
  return wilayah;
}

export type FilterDinas = FilterWilayah | { galat: NextResponse };

/**
 * Filter wilayah + status sekolah dari parameter URL (provinsi, kabupatenKota, statusSekolah), dibatasi cakupan akun:
 * admin pusat bebas memilih, dinas provinsi bisa mempersempit ke satu kota/kabupaten di provinsinya, dinas kota/
 * kabupaten terkunci di wilayahnya. Isian di luar cakupan ditolak 403 (bukan diam-diam diganti).
 */
export function bacaFilterWilayahDinas(cakupan: CakupanWilayah, url: URL): FilterDinas {
  const hasil = gabungkanFilterWilayah(cakupan, bacaPermintaanFilterWilayah(url.searchParams));
  if (!hasil.ok) return { galat: NextResponse.json({ error: hasil.pesan }, { status: hasil.status }) };
  return hasil.filter;
}

type SiswaUntukCakupan = {
  jalur: string;
  deletedAt: Date | null;
  school: SekolahBerwilayah | null;
};

/**
 * Apakah satu siswa boleh dilihat akun dinas dengan wilayah `wilayah`. Sama dengan cakupan daftar/analitik
 * dinas: siswa Jalur A (terikat sekolah), belum dihapus, dan sekolahnya berada di wilayah itu (kota/kabupaten
 * untuk dinas kota/kabupaten, provinsi untuk dinas provinsi). Siswa mandiri (Jalur B) TIDAK termasuk walau mencatat
 * sekolah asal - itu isian bebas siswa, bukan keterikatan sekolah, dan sekolah/dinas tidak berhak atas riwayatnya.
 * Wilayah kosong = tidak boleh melihat siapa pun (gagal tertutup).
 */
export function siswaDalamWilayahDinas(siswa: SiswaUntukCakupan, wilayah: CakupanWilayah | null): boolean {
  return siswa.jalur === "A" && siswa.deletedAt === null && sekolahDalamCakupan(siswa.school, wilayah);
}
