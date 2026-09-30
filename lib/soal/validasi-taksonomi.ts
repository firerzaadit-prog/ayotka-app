import "server-only";
import { prisma } from "@/lib/db/prisma";

/**
 * ID kompetensi/elemen dari form soal dulu langsung dikirim ke Postgres. ID
 * yang tidak ada (dihapus admin lain saat form masih terbuka, atau dikirim
 * langsung ke API) gagal di foreign key dan muncul sebagai HTTP 500. Dicek
 * dulu di sini supaya jadi pesan yang jelas. Kompetensi juga wajib dari mata
 * pelajaran paketnya, sama seperti aturan impor Excel
 * (lib/soal/kompetensi-ref.ts) - kalau tidak, skor kompetensi siswa tercatat
 * di mapel yang salah.
 *
 * Mengembalikan pesan error, atau null kalau valid.
 */
export async function cekTaksonomiSoal(
  packageId: string,
  input: { kompetensiId: string; elemenId?: string | null },
): Promise<string | null> {
  const [pkg, kompetensi] = await Promise.all([
    prisma.package.findUnique({ where: { id: packageId }, select: { subjectId: true } }),
    prisma.kompetensi.findUnique({
      where: { id: input.kompetensiId },
      select: { elemen: { select: { subjectId: true } } },
    }),
  ]);
  if (!kompetensi) {
    return "Kompetensi tidak ditemukan (mungkin baru dihapus). Muat ulang halaman lalu pilih kompetensi lagi.";
  }
  if (pkg && kompetensi.elemen.subjectId !== pkg.subjectId) {
    return "Kompetensi yang dipilih bukan dari mata pelajaran paket soal ini.";
  }

  if (input.elemenId) {
    const elemen = await prisma.elemen.findUnique({ where: { id: input.elemenId }, select: { id: true } });
    if (!elemen) return "Elemen tidak ditemukan (mungkin baru dihapus). Muat ulang halaman lalu pilih lagi.";
  }
  return null;
}
