/**
 * Kirim email lewat HTTP API Resend langsung (bukan SMTP). Dibuat khusus
 * untuk email konfirmasi registrasi siswa mandiri, setelah terbukti lewat
 * investigasi manual (25 Agustus 2026) bahwa integrasi SMTP custom Supabase
 * ke Resend gagal secara konsisten (request tidak pernah sampai ke Resend
 * sama sekali - dikonfirmasi lewat log Resend yang tidak pernah bertambah),
 * padahal panggilan langsung ke HTTP API Resend berhasil setiap saat.
 *
 * Sengaja terpisah dari lib/email/mailer.ts (nodemailer/SMTP, dipakai untuk
 * email pengingat billing Tiket 6.9) - itu pakai kredensial Gmail yang
 * berbeda dan belum ada laporan bermasalah, tidak perlu ikut diubah.
 *
 * Kegagalan sesaat (jaringan putus, 429 karena batas kecepatan, 5xx dari
 * Resend) dicoba ulang otomatis beberapa kali dengan jeda pendek, supaya
 * lonjakan pendaftaran tidak langsung berujung email hilang. Kuota HARIAN/
 * BULANAN habis (Resend membalas 429 dengan nama error "*_quota_exceeded")
 * TIDAK dicoba ulang - menunggu beberapa detik tidak akan menolong, pemanggil
 * perlu menampilkan pesan yang jujur dan menawarkan kirim ulang nanti.
 *
 * Tanpa "server-only": mengikuti pola yang sama seperti lib/email/mailer.ts
 * - modul ini cuma baca process.env saat runtime, tidak menaruh secret
 * sebagai literal di kode yang di-bundle.
 */

export type SendViaResendInput = { to: string; subject: string; html: string };
export type SendViaResendResult =
  | { ok: true }
  | { ok: false; error: string; kuotaHabis: boolean };

type SendOptions = { retryDelaysMs?: number[] };

import { getResolvedResendConfig } from "@/lib/settings/app-settings";

/** Jeda sebelum percobaan ulang ke-1 dan ke-2 (total 3 percobaan). */
const DEFAULT_RETRY_DELAYS_MS = [400, 1200];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isKuotaHabis(status: number, body: string): boolean {
  if (status !== 429) return false;
  try {
    const parsed = JSON.parse(body) as { name?: unknown };
    return typeof parsed.name === "string" && parsed.name.includes("quota");
  } catch {
    return false;
  }
}

export async function sendViaResendApi(
  { to, subject, html }: SendViaResendInput,
  options: SendOptions = {},
): Promise<SendViaResendResult> {
  const { apiKey, fromEmail } = await getResolvedResendConfig();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY belum diisi di Pengaturan Sistem atau .env", kuotaHabis: false };
  }
  const from = fromEmail || "AyoTKA <noreply@ayotka.id>";
  const delays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;

  let lastError = "Gagal mengirim email.";
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    let retryable = false;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [to], subject, html }),
      });

      if (res.ok) return { ok: true };

      const body = await res.text().catch(() => "");
      lastError = `Resend API error ${res.status}: ${body || res.statusText}`;
      if (isKuotaHabis(res.status, body)) return { ok: false, error: lastError, kuotaHabis: true };
      retryable = res.status === 429 || res.status >= 500;
    } catch (err) {
      lastError = `Resend tidak terjangkau: ${err instanceof Error ? err.message : String(err)}`;
      retryable = true;
    }

    if (!retryable || attempt === delays.length) break;
    await sleep(delays[attempt]!);
  }

  return { ok: false, error: lastError, kuotaHabis: false };
}
