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
