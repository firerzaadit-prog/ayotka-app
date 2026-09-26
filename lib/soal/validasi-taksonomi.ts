import "server-only";
import { prisma } from "@/lib/db/prisma";

/**
 * ID kompetensi/materi/sub-materi dari form soal dulu langsung dikirim ke
 * Postgres. ID yang tidak ada (dihapus admin lain saat form masih terbuka, atau
 * dikirim langsung ke API) gagal di foreign key dan muncul sebagai HTTP 500.
 * Dicek dulu di sini supaya jadi pesan yang jelas. Kompetensi juga wajib dari
 * mata pelajaran paketnya, sama seperti aturan impor Excel
 * (lib/soal/kompetensi-ref.ts) - kalau tidak, skor kompetensi siswa tercatat
 * di mapel yang salah.
 *
 * Mengembalikan pesan error, atau null kalau valid.
 */
export async function cekTaksonomiSoal(
  packageId: string,
  input: { kompetensiId: string; materiId?: string | null; subMateriId?: string | null },
): Promise<string | null> {
  const [pkg, kompetensi] = await Promise.all([
    prisma.package.findUnique({ where: { id: packageId }, select: { subjectId: true } }),
    prisma.kompetensi.findUnique({
      where: { id: input.kompetensiId },
      select: { subMateri: { select: { materi: { select: { subjectId: true } } } } },
    }),
  ]);
  if (!kompetensi) {
    return "Kompetensi tidak ditemukan (mungkin baru dihapus). Muat ulang halaman lalu pilih kompetensi lagi.";
  }
  if (pkg && kompetensi.subMateri.materi.subjectId !== pkg.subjectId) {
    return "Kompetensi yang dipilih bukan dari mata pelajaran paket soal ini.";
  }

  if (input.materiId) {
    const materi = await prisma.materi.findUnique({ where: { id: input.materiId }, select: { id: true } });
    if (!materi) return "Materi tidak ditemukan (mungkin baru dihapus). Muat ulang halaman lalu pilih lagi.";
  }
  if (input.subMateriId) {
    const subMateri = await prisma.subMateri.findUnique({ where: { id: input.subMateriId }, select: { id: true } });
    if (!subMateri) return "Sub-materi tidak ditemukan (mungkin baru dihapus). Muat ulang halaman lalu pilih lagi.";
  }
  return null;
}
