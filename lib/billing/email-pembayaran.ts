import { createCipheriv, createDecipheriv, createHmac } from "node:crypto";
import { EMAIL_PEMBAYARAN, adalahEmailSintetis } from "@/lib/billing/pembayaran-affiliate";

/**
 * Alamat pembayaran khusus untuk siswa yang masuk memakai NISN (email akunnya sintetis dan tidak bisa menerima email).
 *
 * Pembayaran affiliate.id dicocokkan ke akun lewat email. Email sintetis memuat NISN anak, jadi tidak dikirim ke pihak ketiga.
 * Sebagai gantinya tiap siswa mendapat alamat tetap `s<32 hex>@bayar.ayotka.id` yang diturunkan dari ID siswa dengan kunci server:
 * tidak memuat NISN, tidak bisa ditebak tanpa kunci, dan bisa dibalik oleh server (check-email dan pemenuhan pembayaran) tanpa
 * menyimpan apa pun di database. Satu blok AES-128 (ID siswa = tepat 16 byte) sehingga hasilnya deterministik dan tidak ada tabrakan.
 * Alamat itu tidak punya kotak surat: bukti pembayaran dari affiliate.id tidak sampai ke siswa, tetapi saldo/langganan tetap masuk
 * otomatis dan terlihat di halaman Wallet/Langganan.
 *
 * Bila kunci server (APP_ENCRYPTION_KEY) diganti, alamat berubah: pembayaran yang sedang berjalan saat itu gagal dicocokkan dan
 * tercatat di Admin Pusat > Verifikasi Pembayaran untuk diaktifkan manual.
 */
const LABEL_KUNCI = "ayotka:email-pembayaran:v1";
const POLA = /^s([0-9a-f]{32})@bayar\.ayotka\.id$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Env = Record<string, string | undefined>;

function kunciBlok(env: Env): Buffer | null {
  const dasar = env.APP_ENCRYPTION_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dasar) return null;
  return createHmac("sha256", dasar).update(LABEL_KUNCI).digest().subarray(0, 16);
}

/** Alamat pembayaran siswa; null bila ID bukan UUID atau server tidak punya kunci. */
export function emailPembayaranSiswa(studentId: string, env: Env = process.env): string | null {
  const kunci = kunciBlok(env);
  if (!kunci || !UUID.test(studentId)) return null;
  const sandi = createCipheriv("aes-128-ecb", kunci, null);
  sandi.setAutoPadding(false);
  const blok = Buffer.concat([sandi.update(Buffer.from(studentId.replace(/-/g, ""), "hex")), sandi.final()]);
  return `s${blok.toString("hex")}@${EMAIL_PEMBAYARAN.domain}`;
}

/** ID siswa dari alamat pembayarannya; null bila bukan alamat pembayaran (atau server tidak punya kunci). */
export function studentIdDariEmailPembayaran(email: string | null | undefined, env: Env = process.env): string | null {
  const cocok = POLA.exec((email ?? "").trim());
  const kunci = kunciBlok(env);
  if (!cocok || !kunci) return null;
  const sandi = createDecipheriv("aes-128-ecb", kunci, null);
  sandi.setAutoPadding(false);
  const hex = Buffer.concat([sandi.update(Buffer.from(cocok[1]!, "hex")), sandi.final()]).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Email yang dibawa tautan bayar ke checkout affiliate.id: email akun bila itu email sungguhan; alamat pembayaran khusus untuk
 * akun NISN. Bila server tidak bisa membuatnya, email akun apa adanya dikembalikan (pembangun tautan membuang yang sintetis).
 */
export function emailUntukCheckout(emailAkun: string, studentId: string, env: Env = process.env): string {
  return adalahEmailSintetis(emailAkun) ? (emailPembayaranSiswa(studentId, env) ?? emailAkun) : emailAkun;
}
