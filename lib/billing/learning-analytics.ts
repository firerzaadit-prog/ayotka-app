/**
 * Aturan "boleh/tidak mengaktifkan Learning Analytics (LA) untuk satu sesi
 * Try Out Mandiri" - murni (tanpa DB) supaya bisa dites & dipakai sama persis
 * oleh route mulai ujian (app/api/siswa/attempts) dan ringkasan akses di
 * halaman instruksi (lib/billing/akses-ujian.ts).
 *
 * Tiga jenis akses (permintaan user, 30 Sep 2026 - paket gratis kini juga
 * boleh beli LA pakai saldo/kredit):
 * - "gratis":    belum punya langganan aktif & belum ditanggung sekolah. LA tidak
 *                pernah gratis; hanya jalan kalau saldo cukup untuk harga satu LA.
 * - "langganan": jatah LA per mapel dari paket dulu; kalau jatahnya habis, saldo.
 * - "sekolah":   ditanggung sekolah (borongan di luar sistem), tanpa jatah/saldo.
 */
export type TipeAkses = "gratis" | "langganan" | "sekolah";

export type SumberDanaLA = "sekolah" | "kuota" | "saldo";

export type PutusanLA =
  | { diminta: true; sumber: SumberDanaLA }
  | { diminta: false; alasan: "saldo_tidak_cukup"; saldo: number; harga: number };

/**
 * Sumber dana yang DIPAKAI PEMROSES analisis (lib/ai/queue-worker.ts) untuk satu percobaan yang sudah selesai:
 * - "kuota": jatah gratis (paket, atau dibundel pada Try Out Nasional) - tidak ada debit saldo;
 * - "saldo": dipotong dari saldo siswa.
 * Dipisah dari putuskanLearningAnalytics di atas (yang menjawab "boleh MULAI ujian dengan LA?"): fungsi ini menjawab
 * "apa yang akan terjadi SEKARANG saat analisisnya diproses". Pemroses, pemicu otomatis, dan tombol Learning Analytics
 * susulan di halaman hasil memakai fungsi ini bersama-sama supaya keputusan uangnya tidak pernah berbeda-beda.
 */
export type PendanaanLA = "kuota" | "saldo";

export function tentukanPendanaanLA(input: {
  kategori: "mandiri" | "nasional";
  /** Percobaan gratis (tanpa kursi sekolah/langganan saat dimulai): tidak pernah memakai jatah paket. */
  freeTrial: boolean;
  /** Sisa jatah LA per mapel dari paket aktif; null = tidak ada paket aktif / tidak dihitung. */
  kuotaSisa: number | null;
}): PendanaanLA {
  // Try Out Nasional selalu dibundel (lihat lib/billing/plan-fitur.ts): tidak pernah didebit.
  if (input.kategori === "nasional") return "kuota";
  if (!input.freeTrial && input.kuotaSisa != null && input.kuotaSisa > 0) return "kuota";
  return "saldo";
}

/**
 * Apa yang bisa dilakukan siswa terhadap satu percobaan yang sudah selesai: menjalankan Learning Analytics SUSULAN
 * (tanpa mengaktifkannya saat ujian dimulai). Dihitung di server (lib/billing/la-susulan.ts), dibaca halaman hasil.
 */
export type OpsiLaSusulan =
  | { tersedia: false; alasan: "belum_selesai" | "sudah_ada" | "sedang_diproses" | "nasional" }
  | {
      tersedia: true;
      pendanaan: "kuota";
      /** Sisa jatah LA gratis dari paket untuk mapel ini (sebelum dipakai sekarang). */
      kuotaSisa: number | null;
      /** Batas "maksimal N analisis otomatis per siswa per mapel" sudah tercapai: tombol dinonaktifkan. */
      batasTercapai: boolean;
      batasMaks: number;
    }
  | {
      tersedia: true;
      pendanaan: "saldo";
      harga: number;
      saldo: number;
      cukup: boolean;
      /** harga - saldo bila saldo kurang, selain itu 0. */
      kurang: number;
    };

export function putuskanLearningAnalytics(input: {
  tipe: TipeAkses;
  /** Sisa jatah LA gratis dari paket untuk mapel ini; null = tidak berlaku (gratis/sekolah). */
  kuotaSisa: number | null;
  saldo: number;
  harga: number;
}): PutusanLA {
  const { tipe, kuotaSisa, saldo, harga } = input;
  if (tipe === "sekolah") return { diminta: true, sumber: "sekolah" };
  if (tipe === "langganan" && kuotaSisa != null && kuotaSisa > 0) {
    return { diminta: true, sumber: "kuota" };
  }
  if (saldo >= harga) return { diminta: true, sumber: "saldo" };
  return { diminta: false, alasan: "saldo_tidak_cukup", saldo, harga };
}
