import nodemailer from "nodemailer";

/**
 * Tiket 6.9: kirim email lewat SMTP polos (nodemailer) - bukan Supabase Auth
 * (itu cuma untuk verifikasi email/reset password, lihat .env.example).
 * Kalau EMAIL_SMTP_* belum diisi (mis. di dev/staging sebelum admin isi
 * kredensial asli), JANGAN lempar error - log peringatan dan lewati,
 * supaya cron billing tetap jalan lengkap untuk bagian lain (transisi
 * status) walau pengiriman email belum aktif.
 *
 * Sengaja TANPA "server-only": satu-satunya pemanggil saat ini adalah
 * scripts/cron-langganan.ts (dijalankan lewat tsx, bukan Next.js) - modul
 * ber-"server-only" tidak bisa diimpor dari situ (lihat penjelasan sama di
 * lib/billing/cron.ts). Tidak berisiko bocor ke browser: nilai
 * EMAIL_SMTP_* cuma dibaca lewat process.env saat runtime, tidak pernah
 * jadi literal di kode yang di-bundle.
 */
import { getResolvedSmtpConfig } from "@/lib/settings/app-settings";

async function getTransporter(): Promise<ReturnType<typeof nodemailer.createTransport> | null> {
  const config = await getResolvedSmtpConfig();
  if (!config.host || !config.user || !config.pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });
}

export type SendMailInput = { to: string; subject: string; text: string };

/** Return false = tidak terkirim (SMTP belum dikonfigurasi atau gagal), bukan throw - pemanggil (cron) tetap lanjut ke penerima berikutnya. */
export async function sendMail({ to, subject, text }: SendMailInput): Promise<boolean> {
  const config = await getResolvedSmtpConfig();
  const transporter = await getTransporter();
  if (!transporter) {
    console.warn(`[email] EMAIL_SMTP_* belum diisi di Pengaturan Sistem atau .env - lewati kirim ke ${to}: "${subject}"`);
    return false;
  }

  try {
    await transporter.sendMail({ from: config.user, to, subject, text });
    return true;
  } catch (error) {
    console.error(`[email] Gagal kirim ke ${to}:`, error instanceof Error ? error.message : error);
    return false;
  }
}
