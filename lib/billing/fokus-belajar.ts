import "server-only";
import type { Attempt } from "@prisma/client";
import { hitungOpsiLaSusulan } from "@/lib/billing/la-susulan";
import { bisaLihatFokusBelajar, type OpsiLaSusulan } from "@/lib/billing/learning-analytics";

/**
 * Apakah "Prioritas belajar" dan "Kekuatanmu" boleh tampil untuk percobaan ini (halaman hasil dan rapor PDF siswa).
 * Aturannya satu-satunya di bisaLihatFokusBelajar: terbuka bila Learning Analytics AKTIF untuk percobaan ini (analisisnya
 * sudah ada/sedang diproses, Try Out Nasional, jatah paket masih ada, atau saldo cukup), selain itu tertutup - sama persis
 * dengan kartu Learning Analytics di halaman hasil. Siswa sekolah TIDAK diberi pengecualian: pemroses analisis
 * (lib/ai/queue-worker.ts) tidak membedakan mereka - jatah paket dulu, saldo sesudahnya, dan dilewati bila saldo kurang -
 * sehingga kartu LA menagih saldo mereka juga, dan kartu fokus harus ikut tertutup selama LA belum aktif.
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
  return bisaLihatFokusBelajar(opsiAkhir);
}
