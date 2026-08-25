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
 * Tanpa "server-only": mengikuti pola yang sama seperti lib/email/mailer.ts
 * - modul ini cuma baca process.env saat runtime, tidak menaruh secret
 * sebagai literal di kode yang di-bundle.
 */

export type SendViaResendInput = { to: string; subject: string; html: string };
export type SendViaResendResult = { ok: true } | { ok: false; error: string };

export async function sendViaResendApi({ to, subject, html }: SendViaResendInput): Promise<SendViaResendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY belum diisi di .env" };
  }
  const from = process.env.RESEND_FROM_EMAIL || "AyoTKA <noreply@ayotka.id>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Resend API error ${res.status}: ${body || res.statusText}` };
  }

  return { ok: true };
}
