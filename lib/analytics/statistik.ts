/** Fungsi statistik murni (tanpa I/O) dipakai untuk ringkasan skor lintas sekolah. */

export function hitungRerata(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, v) => total + v, 0) / values.length;
}

/** Standar deviasi populasi (bukan sampel) - values dianggap seluruh populasi yang difilter, bukan sampel acak darinya. */
export function hitungStandarDeviasi(values: number[]): number {
  if (values.length === 0) return 0;
  const rerata = hitungRerata(values);
  const variansi = values.reduce((total, v) => total + (v - rerata) ** 2, 0) / values.length;
  return Math.sqrt(variansi);
}

/**
 * Persentil dengan interpolasi linear antar dua titik data terdekat (metode
 * yang sama dengan default numpy.percentile). `sorted` harus sudah terurut menaik.
 */
export function hitungPersentil(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower]!;
  const weight = idx - lower;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * weight;
}
