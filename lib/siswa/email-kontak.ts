import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Email kontak untuk akun siswa yang masuk dengan NISN (permintaan pemilik, 16 Okt 2026). Email login akun NISN sintetis
 * (`{nisn}@nisn.ayotka.id`) dan tidak punya kotak surat, jadi siswa tidak bisa menerima tautan lupa password maupun bukti
 * pembayaran. Email kontak ini TERPISAH dari email login: cara masuk tetap NISN + password.
 *
 * Keamanan: email kontak hanya dipakai untuk hal sensitif (tautan atur ulang password) setelah DIVERIFIKASI. Alamat yang
 * salah ketik atau milik orang lain tidak pernah menerima tautan itu karena pemiliknya tidak bisa mengklik tautan
 * verifikasi untuk akun orang lain. Pemasangan, penggantian, dan pelepasan email kontak wajib password saat ini.
 *
 * Verifikasi memakai token bertanda tangan (HMAC-SHA256, tanpa tabel tambahan): memuat ID siswa, alamat yang diverifikasi,
 * dan batas waktu. Kunci diturunkan dari kunci server (APP_ENCRYPTION_KEY, cadangan SUPABASE_SERVICE_ROLE_KEY) seperti
 * alamat pembayaran khusus (lib/billing/email-pembayaran.ts). Mengganti kunci server membatalkan tautan yang beredar;
 * siswa tinggal meminta tautan baru. Token mengikat ALAMAT, jadi mengganti alamat langsung menghanguskan tautan lama.
 */
const LABEL_KUNCI = "ayotka:email-kontak:v1";
export const MASA_BERLAKU_TOKEN_MS = 48 * 3_600_000;

type Env = Record<string, string | undefined>;

function kunci(env: Env): Buffer | null {
  const dasar = env.APP_ENCRYPTION_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dasar) return null;
  return createHmac("sha256", dasar).update(LABEL_KUNCI).digest();
}

const b64 = (nilai: Buffer | string) => Buffer.from(nilai).toString("base64url");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Token verifikasi untuk (siswa, alamat); null bila server tidak punya kunci atau ID bukan UUID. */
export function buatTokenEmailKontak(
  input: { studentId: string; email: string; sekarang?: Date },
  env: Env = process.env,
): string | null {
  const k = kunci(env);
  if (!k || !UUID.test(input.studentId)) return null;
  const berakhir = Math.floor(((input.sekarang ?? new Date()).getTime() + MASA_BERLAKU_TOKEN_MS) / 1000);
  const muatan = b64(JSON.stringify({ s: input.studentId, e: input.email.trim().toLowerCase(), x: berakhir }));
  return `${muatan}.${b64(createHmac("sha256", k).update(muatan).digest())}`;
}

export type HasilPeriksaToken =
  | { ok: true; studentId: string; email: string }
  | { ok: false; alasan: "tidak_sah" | "kedaluwarsa" | "tanpa_kunci" };

/** Memeriksa tanda tangan, bentuk, dan batas waktu token; tidak menyentuh database. */
export function periksaTokenEmailKontak(
  token: string,
  sekarang: Date = new Date(),
  env: Env = process.env,
): HasilPeriksaToken {
  const k = kunci(env);
  if (!k) return { ok: false, alasan: "tanpa_kunci" };

  const bagian = token.trim().split(".");
  if (bagian.length !== 2 || !bagian[0] || !bagian[1]) return { ok: false, alasan: "tidak_sah" };
  const [muatan, tanda] = bagian as [string, string];

  const harapan = createHmac("sha256", k).update(muatan).digest();
  let diterima: Buffer;
  try {
    diterima = Buffer.from(tanda, "base64url");
  } catch {
    return { ok: false, alasan: "tidak_sah" };
  }
  if (diterima.length !== harapan.length || !timingSafeEqual(diterima, harapan)) return { ok: false, alasan: "tidak_sah" };

  let isi: unknown;
  try {
    isi = JSON.parse(Buffer.from(muatan, "base64url").toString("utf8"));
  } catch {
    return { ok: false, alasan: "tidak_sah" };
  }
  const { s, e, x } = (isi ?? {}) as { s?: unknown; e?: unknown; x?: unknown };
  if (typeof s !== "string" || !UUID.test(s) || typeof e !== "string" || !e || typeof x !== "number" || !Number.isFinite(x)) {
    return { ok: false, alasan: "tidak_sah" };
  }
  if (sekarang.getTime() > x * 1000) return { ok: false, alasan: "kedaluwarsa" };
  return { ok: true, studentId: s, email: e };
}

export type StatusEmailKontak = { alamat: string; terverifikasi: boolean } | null;

/** Ringkasan untuk layar Profil dan Admin Pusat. Alamat tanpa verifikasi tetap ditampilkan, ditandai belum terverifikasi. */
export function ringkasEmailKontak(siswa: { emailKontak: string | null; emailKontakVerifiedAt: Date | null }): StatusEmailKontak {
  if (!siswa.emailKontak) return null;
  return { alamat: siswa.emailKontak, terverifikasi: siswa.emailKontakVerifiedAt != null };
}

/** Email kontak yang BOLEH dikirimi hal sensitif: ada dan sudah diverifikasi; selain itu null. */
export function emailKontakTerverifikasi(siswa: { emailKontak: string | null; emailKontakVerifiedAt: Date | null }): string | null {
  return siswa.emailKontak && siswa.emailKontakVerifiedAt ? siswa.emailKontak : null;
}

/** "3155213156" -> "NISN ******3156": cukup untuk dikenali pemiliknya di email, tanpa membuka NISN utuh. */
export function labelNisnTersamar(nisn: string | null | undefined): string {
  const angka = (nisn ?? "").replace(/\D/g, "");
  return angka.length >= 4 ? `NISN ${"*".repeat(Math.max(angka.length - 4, 0))}${angka.slice(-4)}` : "akun NISN";
}

/** "budi@contoh.id" -> "b***@contoh.id": untuk menunjukkan ke pemilik akun tanpa membuka alamat utuh. */
export function samarkanEmail(email: string): string {
  const [nama = "", domain = ""] = email.split("@");
  if (!domain) return "***";
  return `${nama.slice(0, 1)}***@${domain}`;
}
