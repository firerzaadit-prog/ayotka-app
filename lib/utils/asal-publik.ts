/**
 * Alamat publik situs (mis. "https://ayotka.id") untuk membangun redirect ABSOLUT dari rute API.
 *
 * Di produksi aplikasi berjalan di belakang nginx yang tidak meneruskan header Host asli, sehingga
 * `new URL(request.url).origin` berisi alamat internal ("https://localhost:3001"). Redirect rute API yang dibangun dari
 * situ membawa pengguna ke alamat yang tidak bisa dibuka ("This site can't be reached"): itulah yang merusak tautan di
 * email konfirmasi pendaftaran dan reset password (/api/auth/confirm), serta pengalihan setelah logout paksa dan setelah
 * pembayaran affiliate. Redirect dari proxy.ts tidak terkena karena Next menjadikannya relatif.
 *
 * Di produksi dipakai NEXT_PUBLIC_APP_URL (juga yang dipakai untuk menyusun tautan di dalam email, jadi keduanya selalu
 * sama). Di luar produksi (next dev, tes) alamat permintaan dipakai apa adanya supaya localhost tetap kembali ke
 * localhost. Bila env produksi kosong atau bukan alamat http(s) yang sah, jatuh ke alamat permintaan (perilaku lama).
 */
function asalDariUrl(nilai: string | undefined): string | null {
  const mentah = nilai?.trim();
  if (!mentah) return null;
  try {
    const u = new URL(mentah);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

export function asalPublik(request: Request): string {
  if (process.env.NODE_ENV === "production") {
    const dariEnv = asalDariUrl(process.env.NEXT_PUBLIC_APP_URL);
    if (dariEnv) return dariEnv;
  }
  return new URL(request.url).origin;
}
