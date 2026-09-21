/**
 * Kolom "kode referral" di pendaftaran mandiri menerima DUA jenis kode: kode
 * referral teman (siswa) atau kode referral mitra. Bagian murni ini dipakai
 * server maupun halaman pendaftaran (client), jadi tanpa import server-only.
 */

/** Huruf besar & tanpa spasi - orang sering menyalin kode dengan spasi ikut atau mengetik huruf kecil. */
export function normalizeKodeReferral(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Kode kami huruf/angka 4-12 karakter; bentuk lain pasti bukan kode (tidak perlu ke database). */
export function bentukKodeValid(kode: string): boolean {
  return /^[A-Z0-9]{4,12}$/.test(kode);
}
