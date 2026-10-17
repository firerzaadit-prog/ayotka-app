import "server-only";
import type { Attempt } from "@prisma/client";
import { hitungOpsiLaSusulan } from "@/lib/billing/la-susulan";
import { bisaLihatFokusBelajar, type OpsiLaSusulan } from "@/lib/billing/learning-analytics";

/**
 * Apakah "Prioritas belajar" dan "Kekuatanmu" boleh tampil untuk percobaan ini (halaman hasil dan rapor PDF siswa).
 * Terbuka hanya bila Learning Analytics sudah DIAKTIFKAN siswa untuk percobaan ini (aturan di bisaLihatFokusBelajar:
 * analisis sudah ada/sedang diproses, atau Try Out Nasional yang dibundel), atau siswa memintanya saat memulai ujian
 * (`analisisAiDiminta`) dan analisisnya baru akan masuk antrean. Punya jatah atau saldo belum cukup. Siswa sekolah tidak
 * mendapat pengecualian: pemroses analisis (lib/ai/queue-worker.ts) tidak membedakan mereka.
 *
 * `opsi` boleh diteruskan bila pemanggil sudah menghitungnya (rute hasil), supaya tidak dihitung dua kali; tanpa itu
 * dihitung di sini. Hanya MEMBACA. Gagal menghitung dianggap tertutup (lihat bisaLihatFokusBelajar).
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
  // Diminta saat ujian dimulai (jatah/saldo sudah dipastikan saat itu) tetapi analisisnya belum masuk antrean: sudah aktif.
  const selesai = attempt.status === "selesai" || attempt.status === "kedaluwarsa";
  return selesai && attempt.analisisAiDiminta === true;
}
