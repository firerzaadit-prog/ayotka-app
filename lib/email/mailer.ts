import nodemailer from "nodemailer";

/**
 * Kirim email lewat SMTP polos (nodemailer): Gmail (smtp.gmail.com), atau penyedia SMTP lain - bukan Resend/Mailketing
 * (lihat lib/email/kirim.ts) sehingga TIDAK memakai kuota keduanya. Kredensial dibaca lewat getResolvedSmtpConfig():
 * Admin Pusat > Pengaturan > Layanan Email (disimpan terenkripsi) dulu, lalu EMAIL_SMTP_* di .env.
 *
 * Untuk Gmail: host smtp.gmail.com, port 465 (SSL) atau 587 (STARTTLS), username = alamat Gmail, password = "App
 * Password" 16 karakter (bukan password Gmail; butuh Verifikasi 2 Langkah aktif). Alamat pengirim yang tampil di penerima
 * selalu alamat Gmail itu (Gmail menimpa From). Batas kirim Gmail biasa sekitar 500 penerima per hari.
 *
 * Kalau SMTP belum diisi, TIDAK melempar galat: hasilnya { ok: false, kode: "belum_diatur" } supaya pemanggil (mis.
 * pembuatan akun) tetap berjalan dan menampilkan alasannya. Sengaja TANPA "server-only": modul ini pernah dipanggil
 * dari skrip tsx di luar Next.js (lihat catatan serupa di lib/billing/cron.ts). Nilai SMTP hanya dibaca saat runtime.
 */
import { getResolvedSmtpConfig } from "@/lib/settings/app-settings";

export type SendMailInput = { to: string; subject: string; text: string; html?: string };

export type KonfigSmtp = { host: string; port: number; user: string; pass: string };

export type KodeGalatSmtp = "belum_diatur" | "login_ditolak" | "tidak_terhubung" | "penerima_ditolak" | "gagal";

export type HasilKirimSmtp = { ok: true } | { ok: false; kode: KodeGalatSmtp; error: string };

/** Batas waktu supaya halaman admin tidak menggantung bila server SMTP lambat atau portnya diblokir (milidetik). */
const BATAS_TERHUBUNG_MS = 8_000;
const BATAS_SOKET_MS = 15_000;

const KODE_TIDAK_TERHUBUNG = new Set(["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNREFUSED", "ENOTFOUND", "EDNS", "ECONNRESET", "EHOSTUNREACH"]);

/**
 * Terjemahkan galat nodemailer menjadi kode + kalimat Indonesia yang bisa ditindaklanjuti admin. Murni. Pesan aslinya
 * (tanpa kata sandi: nodemailer tidak pernah memuatnya) hanya dipakai untuk kasus yang tidak dikenali, dipotong pendek.
 */
export function jelaskanGalatSmtp(err: unknown): { kode: Exclude<KodeGalatSmtp, "belum_diatur">; error: string } {
  const e = (err ?? {}) as { code?: unknown; responseCode?: unknown; message?: unknown };
  const kode = typeof e.code === "string" ? e.code : "";
  const rc = typeof e.responseCode === "number" ? e.responseCode : 0;
  const pesan = typeof e.message === "string" ? e.message : "";

  if (kode === "EAUTH" || rc === 535 || rc === 534) {
    return {
      kode: "login_ditolak",
      error:
        "Login SMTP ditolak. Untuk Gmail: isi username dengan alamat Gmail lengkap dan password dengan App Password 16 karakter (bukan password Gmail biasa); Verifikasi 2 Langkah harus aktif.",
    };
  }
  if (KODE_TIDAK_TERHUBUNG.has(kode) || /wrong version number|ssl routines/i.test(pesan)) {
    return {
      kode: "tidak_terhubung",
      error:
        "Tidak bisa terhubung ke server SMTP. Periksa host dan port (Gmail: smtp.gmail.com port 465, atau 587), dan pastikan server tidak memblokir port itu.",
    };
  }
  if (kode === "EENVELOPE" || rc === 550 || rc === 551 || rc === 553 || rc === 501) {
    return { kode: "penerima_ditolak", error: "Server email menolak alamat penerima. Periksa penulisan alamat emailnya." };
  }
  const ringkas = pesan.replace(/\s+/g, " ").trim().slice(0, 200);
  return { kode: "gagal", error: ringkas ? `Email gagal dikirim: ${ringkas}` : "Email gagal dikirim (sebab tidak diketahui)." };
}

/** Alamat pengirim: "AyoTKA" <alamat> bila username berupa alamat email (Gmail); selain itu dipakai apa adanya. */
export function bentukPengirim(user: string): string | { name: string; address: string } {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user) ? { name: "AyoTKA", address: user } : user;
}

const tanpaBarisBaru = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

/**
 * Kirim satu email lewat SMTP. `konfig` boleh diberikan (uji koneksi dari layar pengaturan memakai isian yang belum
 * disimpan); bila tidak, dibaca dari pengaturan tersimpan/.env. Tidak pernah melempar.
 */
export async function kirimLewatSmtp(input: SendMailInput, konfig?: KonfigSmtp): Promise<HasilKirimSmtp> {
  const config = konfig ?? (await getResolvedSmtpConfig());
  if (!config.host || !config.user || !config.pass) {
    return {
      ok: false,
      kode: "belum_diatur",
      error: "SMTP belum diatur. Isi di Admin Pusat > Pengaturan > Layanan Email (SMTP Server), mis. smtp.gmail.com + App Password Gmail.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      // Port 587 = STARTTLS: wajib terenkripsi sebelum kata sandi dikirim (tidak turun ke teks polos).
      requireTLS: config.port === 587,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: BATAS_TERHUBUNG_MS,
      greetingTimeout: BATAS_TERHUBUNG_MS,
      socketTimeout: BATAS_SOKET_MS,
    });
    await transporter.sendMail({
      from: bentukPengirim(config.user),
      to: input.to,
      subject: tanpaBarisBaru(input.subject),
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });
    return { ok: true };
  } catch (error) {
    const galat = jelaskanGalatSmtp(error);
    console.error(`[email] SMTP gagal (${galat.kode}) ke ${input.to}:`, error instanceof Error ? error.message : error);
    return { ok: false, ...galat };
  }
}

/** Bentuk lama: true = terkirim. Dipertahankan untuk pemanggil yang hanya butuh ya/tidak. */
export async function sendMail(input: SendMailInput): Promise<boolean> {
  const hasil = await kirimLewatSmtp(input);
  if (!hasil.ok && hasil.kode === "belum_diatur") {
    console.warn(`[email] EMAIL_SMTP_* belum diisi di Pengaturan Sistem atau .env - lewati kirim ke ${input.to}: "${input.subject}"`);
  }
  return hasil.ok;
}
