import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Memeriksa password SAAT INI milik sebuah akun sebelum tindakan sensitif (ganti password / ganti email), tanpa menyentuh
 * sesi yang sedang dipakai: memakai klien sementara tanpa penyimpanan sesi, jadi cookie pengguna tidak berubah. Sesi
 * yang terbentuk di layanan login langsung dicabut lagi supaya tidak menumpuk.
 *
 * Hasil:
 * - "benar"     : password cocok;
 * - "salah"     : kredensial ditolak;
 * - "dibatasi"  : penyedia login membatasi laju (429) - bukan salah password;
 * - "layanan"   : layanan login bermasalah (tidak terjangkau, 402, 5xx) - bukan salah password.
 * Klasifikasi mengikuti rute login (app/api/auth/login/route.ts) supaya pesan yang sampai ke pengguna konsisten.
 */
export type HasilVerifikasiPassword = "benar" | "salah" | "dibatasi" | "layanan";

type GalatAuth = { status?: number; name?: string; message?: string; code?: string } | null;

/** Murni: ubah galat layanan login menjadi hasil verifikasi. null = tidak ada galat (password benar). */
export function klasifikasiGalatVerifikasi(error: GalatAuth): HasilVerifikasiPassword {
  if (!error) return "benar";
  if (error.code === "over_request_rate_limit" || error.status === 429) return "dibatasi";
  const status = error.status;
  const pesan = typeof error.message === "string" ? error.message : "";
  if (
    (typeof status === "number" && (status === 0 || status === 402 || status >= 500)) ||
    pesan.includes("exceed_egress_quota") ||
    pesan.includes("restricted due to the following violations") ||
    error.name === "AuthRetryableFetchError" ||
    error.name === "AuthUnknownError"
  ) {
    return "layanan";
  }
  return "salah";
}

export async function verifikasiPasswordSaatIni(email: string, password: string): Promise<HasilVerifikasiPassword> {
  const klien = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  try {
    const { data, error } = await klien.auth.signInWithPassword({ email, password });
    const hasil = klasifikasiGalatVerifikasi(error as GalatAuth);
    if (hasil === "benar" && data.session) {
      // Cabut sesi sementara ini di layanan login; gagal mencabut tidak mengubah hasil verifikasi.
      await klien.auth.signOut({ scope: "local" }).catch(() => {});
    }
    return hasil;
  } catch (err) {
    console.error("[verifikasi-password] layanan login tidak terjangkau:", err instanceof Error ? err.message : err);
    return "layanan";
  }
}
