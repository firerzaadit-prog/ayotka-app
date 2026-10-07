const MENIT = 60_000;
const JAM = 60 * MENIT;
const HARI = 24 * JAM;

/**
 * Sisa waktu menuju suatu saat, dalam kalimat singkat untuk hitung mundur ("2 hari 3 jam", "45 menit").
 * Dibulatkan KE BAWAH ke satuan terkecil yang ditampilkan, jadi tidak pernah menjanjikan lebih lama dari kenyataan.
 * Nol atau negatif -> "sekarang".
 */
export function formatHitungMundur(sisaMs: number): string {
  if (!Number.isFinite(sisaMs) || sisaMs <= 0) return "sekarang";
  if (sisaMs < MENIT) return "kurang dari 1 menit";
  const hari = Math.floor(sisaMs / HARI);
  const jam = Math.floor((sisaMs % HARI) / JAM);
  const menit = Math.floor((sisaMs % JAM) / MENIT);
  if (hari > 0) return jam > 0 ? `${hari} hari ${jam} jam` : `${hari} hari`;
  if (jam > 0) return menit > 0 ? `${jam} jam ${menit} menit` : `${jam} jam`;
  return `${menit} menit`;
}
