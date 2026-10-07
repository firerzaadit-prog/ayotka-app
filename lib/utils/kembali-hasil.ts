const POLA_HASIL = /^\/siswa\/hasil\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tujuan "kembali" yang boleh dipakai halaman Wallet (?kembali=...): HANYA jalur internal ke halaman hasil ujian
 * (/siswa/hasil/<uuid>). Nilai lain (alamat luar, jalur lain, tambahan di belakang) ditolak - mencegah pengalihan terbuka
 * lewat tautan yang dibuat orang lain. Mengembalikan jalur itu apa adanya, atau null bila tidak sah.
 */
export function jalurKembaliHasil(nilai: string | null | undefined): string | null {
  return typeof nilai === "string" && POLA_HASIL.test(nilai) ? nilai : null;
}
