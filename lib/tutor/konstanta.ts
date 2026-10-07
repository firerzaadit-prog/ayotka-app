/**
 * Batas fitur Tanya Tutor AI - satu tempat, dipakai server (validasi) dan klien (pembatas input).
 * Aman diimpor dari komponen klien (tidak menyentuh server/DB).
 */

/** Batas pesan per siswa per hari (hari WIB); server membacanya dari env TUTOR_AI_BATAS_HARIAN bila diatur. */
export const BATAS_HARIAN_BAWAAN = 20;

/** Panjang maksimum satu pesan siswa. */
export const MAKS_PANJANG_PESAN = 1000;

/** Jumlah pesan (siswa + tutor) yang dikirim per permintaan sebagai riwayat percakapan. */
export const MAKS_PESAN_RIWAYAT = 20;

/** Jumlah karakter seluruh pesan dalam satu permintaan. */
export const MAKS_TOTAL_KARAKTER = 8000;

/**
 * Panjang maksimum foto (data URI base64) per permintaan. Sengaja kecil (< 1 MB): nginx bawaan menolak badan permintaan
 * di atas 1 MB, dan foto disusutkan di peramban sebelum dikirim (lihat components/tutor/kompres-gambar.ts).
 */
export const MAKS_GAMBAR_KARAKTER = 700_000;

/** Foto yang disusutkan klien ditargetkan di bawah ini agar selalu lolos batas server. */
export const TARGET_GAMBAR_KARAKTER = 560_000;

/** Batas ukuran berkas foto asli sebelum disusutkan. */
export const MAKS_BERKAS_FOTO_BYTE = 15 * 1024 * 1024;

/** Batas panjang teks yang dikirim ke AI dari data soal (menjaga biaya dan ukuran permintaan). */
export const MAKS_TEKS_SOAL = 6000;
export const MAKS_TEKS_STIMULUS = 8000;
export const MAKS_TEKS_OPSI = 1000;

/** Balasan tutor dipotong sampai sepanjang ini sebelum dikirim ke siswa. */
export const MAKS_PANJANG_BALASAN = 6000;
