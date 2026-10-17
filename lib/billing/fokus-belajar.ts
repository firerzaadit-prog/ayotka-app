import "server-only";
import type { Attempt } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getTipeAkses } from "@/lib/billing/akses-ujian";
import { hitungOpsiLaSusulan } from "@/lib/billing/la-susulan";
import { bisaLihatFokusBelajar, type OpsiLaSusulan } from "@/lib/billing/learning-analytics";

/**
 * Apakah "Prioritas belajar" dan "Kekuatanmu" boleh tampil untuk percobaan ini (halaman hasil dan rapor PDF siswa).
 * Aturannya di bisaLihatFokusBelajar (jatah paket atau saldo Learning Analytics, atau analisisnya sudah ada); di sini
 * ditambah satu pengecualian yang butuh data siswa: akses yang ditanggung sekolah (borongan) tetap terbuka, karena
 * sekolah yang membayar Learning Analytics-nya, bukan saldo siswa.
 *
 * `opsi` boleh diteruskan bila pemanggil sudah menghitungnya (rute hasil), supaya tidak dihitung dua kali; tanpa itu
 * dihitung di sini. Hanya MEMBACA. Gagal menghitung dianggap terbuka (lihat bisaLihatFokusBelajar): gangguan sesaat
 * tidak boleh menyembunyikan fitur dari siswa yang berhak.
 */
export async function hitungFokusBelajarDibuka(attempt: Attempt, opsi?: OpsiLaSusulan | null): Promise<boolean> {
  let opsiAkhir = opsi;
  if (opsiAkhir === undefined) {
    opsiAkhir = await hitungOpsiLaSusulan(attempt).catch((err) => {
      console.error(`[fokus-belajar] gagal menghitung opsi Learning Analytics untuk attempt ${attempt.id}:`, err);
      return null;
    });
  }
  if (bisaLihatFokusBelajar(opsiAkhir)) return true;

  try {
    const siswa = await prisma.student.findUnique({ where: { id: attempt.studentId } });
    if (!siswa) return true;
    return (await getTipeAkses(siswa)) === "sekolah";
  } catch (err) {
    console.error(`[fokus-belajar] gagal memeriksa akses sekolah untuk attempt ${attempt.id}:`, err);
    return true;
  }
}
