/**
 * Taksiran BEBAN AI satu Learning Analytics (LA) untuk sebuah paket, dipakai menentukan harganya (lib/billing/harga-la.ts).
 * Beban = taksiran jumlah TOKEN MASUKAN prompt analisis (lib/ai/prompt.ts). Yang membuat prompt panjang adalah isi paket:
 * setiap soal masuk lengkap (teks soal + jawaban siswa), dan untuk soal yang SALAH ditambah kunci jawaban dan pembahasan.
 * Karena harga harus diketahui sebelum siswa mengerjakan (dan sama bagi semua siswa pada paket yang sama), banyaknya soal
 * yang salah tidak bisa diketahui; dipakai asumsi tetap `RASIO_SALAH`. Pemakaian riil dicatat per analisis
 * (ai_analyses.token_masuk) dan dibandingkan dengan taksiran ini di layar admin pusat, untuk menyetel batas ringan/berat.
 *
 * Murni (tanpa I/O): daftar soal diberikan pemanggil.
 */
export type SoalUntukTaksiran = {
  teks: string;
  pembahasan: string | null;
  /** Teks pilihan jawaban / pernyataan soal; dipakai untuk memperkirakan panjang "jawaban siswa" dan "kunci jawaban". */
  opsi: string[];
};

/** Perkiraan karakter bahasa Indonesia per token Gemini (dibulatkan ke sisi aman: token sedikit lebih banyak). */
export const KARAKTER_PER_TOKEN = 3.5;
/** Karakter prompt yang selalu ada: aturan (sekitar 4.000), ringkasan kerangka asesmen (sekitar 2.000), blok indikator resmi. */
export const KARAKTER_TETAP_PROMPT = 7_500;
/** Karakter tetap per soal: nomor, status, level, "Elemen > Subelemen", label "Jawaban siswa", serta bagian peta kompetensi/indikator. */
export const KARAKTER_TETAP_PER_SOAL = 160;
/** Karakter label tambahan untuk soal salah ("Kunci jawaban:", "Pembahasan:", jeda baris). */
export const KARAKTER_LABEL_SALAH = 40;
/** Asumsi bagian soal yang dijawab salah (kunci + pembahasan ikut masuk prompt). Setengah: sudah mewakili siswa menengah. */
export const RASIO_SALAH = 0.5;

const panjangRapat = (s: string | null | undefined) => (s ? s.replace(/\s+/g, " ").trim().length : 0);

/** Taksiran token masukan satu analisis untuk paket berisi `soal`. Paket tanpa soal tetap punya beban tetap prompt. */
export function taksirBebanAi(soal: SoalUntukTaksiran[]): number {
  let karakter = KARAKTER_TETAP_PROMPT;
  for (const s of soal) {
    const opsi = s.opsi.map(panjangRapat);
    const rataOpsi = opsi.length > 0 ? opsi.reduce((a, b) => a + b, 0) / opsi.length : 0;
    // Jawaban siswa selalu ada; kunci + pembahasan hanya bila salah.
    karakter +=
      KARAKTER_TETAP_PER_SOAL +
      panjangRapat(s.teks) +
      rataOpsi +
      RASIO_SALAH * (KARAKTER_LABEL_SALAH + rataOpsi + panjangRapat(s.pembahasan));
  }
  return Math.round(karakter / KARAKTER_PER_TOKEN);
}

/** Beban paket "ukuran biasa" (tanpa isi): dipakai menerjemahkan beban ke perkiraan banyak soal di layar admin. */
const KARAKTER_SOAL_RATA = KARAKTER_TETAP_PER_SOAL + 300 + 40 + RASIO_SALAH * (KARAKTER_LABEL_SALAH + 40 + 500);

/** Berapa soal berukuran biasa (teks 300 karakter, pembahasan 500 karakter) yang setara dengan `beban` token; sekadar acuan. */
export function perkiraanSoalDariBeban(beban: number): number {
  const sisa = beban * KARAKTER_PER_TOKEN - KARAKTER_TETAP_PROMPT;
  return Math.max(0, Math.round(sisa / KARAKTER_SOAL_RATA));
}
