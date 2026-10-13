/**
 * Teks harga Learning Analytics (LA) tambahan untuk layar siswa. Murni (tanpa I/O) supaya bisa dites; halaman Wallet
 * (client) hanya memanggilnya. Harga LA mengikuti beban AI paket (lib/billing/harga-la.ts), jadi di Wallet yang
 * tampil rentangnya; harga pastinya tampil saat siswa memilih ujian dan di kartu Learning Analytics hasil ujian.
 */
const rupiah = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export function teksHargaLA(data: { hargaLaMin?: number; hargaLaMaks?: number; hargaLearningAnalytics: number }): string {
  const min = data.hargaLaMin ?? data.hargaLearningAnalytics;
  const maks = data.hargaLaMaks ?? data.hargaLearningAnalytics;
  if (min === maks) return `Satu Learning Analytics tambahan = ${rupiah(min)}`;
  return `Satu Learning Analytics tambahan = ${rupiah(min)} - ${rupiah(maks)}, tergantung besarnya paket soal (makin banyak dan panjang soal yang dianalisis AI, makin tinggi harganya). Harga pastinya tampil sebelum kamu memakainya.`;
}
