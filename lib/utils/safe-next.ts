/**
 * Tujuan redirect yang diambil dari parameter URL (`?next=`) hanya boleh path
 * internal. Tanpa ini, link buatan orang lain bisa mengalihkan pengguna ke
 * situs palsu setelah konfirmasi/logout ("https://..", "//situs-lain" dan
 * "/\situs-lain" dianggap browser sebagai domain lain), atau menjalankan skrip
 * lewat "javascript:..". Karakter kontrol ikut ditolak karena browser
 * membuang tab/baris baru dari URL ("/\t/situs-lain" jadi "//situs-lain").
 */
export function safeNext(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  return value;
}
