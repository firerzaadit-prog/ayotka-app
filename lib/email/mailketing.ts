/**
 * Penyedia email CADANGAN (Mailketing, lokal Indonesia, prabayar Rp0,6/email)
 * - dipakai lib/email/kirim.ts hanya saat Resend menolak (kuota harian/
 * bulanan habis, 429, gangguan, API key kosong). Spesifikasi API: POST
 * https://api.mailketing.co.id/api/v2/send (JSON, header X-Api-Token,
 * respons "Email queued successfully" = sudah diterima antrean Mailketing).
 *
 * Kredensial dibaca lewat getResolvedMailketingConfig: Pengaturan Sistem
 * (database, terenkripsi) diutamakan, env (MAILKETING_API_TOKEN /
 * MAILKETING_FROM_EMAIL) sebagai cadangan. Token kosong = penyedia ini MATI
 * (bukan error) dan kirim.ts cuma memakai Resend seperti sebelumnya.
 *
 * Bounce dikenai penalti kredit di Mailketing (30 kredit per email bounce),
 * itulah alasan modul ini sengaja HANYA jalur cadangan, bukan utama.
 *
 * Tanpa "server-only": sama seperti lib/email/resend.ts.
 */

import { getResolvedMailketingConfig } from "@/lib/settings/app-settings";

export type SendViaMailketingInput = { to: string; subject: string; html: string };
export type SendViaMailketingResult =
  | { ok: true }
  | { ok: false; error: string; status?: number };

const ENDPOINT = "https://api.mailketing.co.id/api/v2/send";
const DEFAULT_FROM = "AyoTKA <noreply@ayotka.id>";

export async function mailketingTersedia(): Promise<boolean> {
  return Boolean((await getResolvedMailketingConfig()).apiToken);
}

/** Pecah `Nama <alamat@domain>` jadi nama + alamat (Mailketing minta dua field terpisah). */
export function parseAlamatPengirim(from: string): { nama: string; email: string } {
  const cocok = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (cocok) return { nama: cocok[1]!.trim() || "AyoTKA", email: cocok[2]!.trim() };
  return { nama: "AyoTKA", email: from.trim() };
}

export async function sendViaMailketingApi({
  to,
  subject,
  html,
}: SendViaMailketingInput): Promise<SendViaMailketingResult> {
  const { apiToken, fromEmail } = await getResolvedMailketingConfig();
  if (!apiToken) {
    return { ok: false, error: "Token Mailketing belum diisi di Pengaturan Sistem atau .env" };
  }
  const pengirim = parseAlamatPengirim(fromEmail || DEFAULT_FROM);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Token": apiToken },
      body: JSON.stringify({
        from_name: pengirim.nama,
        from_email: pengirim.email,
        subject,
        recipient: to,
        content: html,
      }),
    });

    const body = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    if (res.ok && body?.success !== false) return { ok: true };

    return {
      ok: false,
      status: res.status,
      error: `Mailketing API error ${res.status}: ${body?.message ?? res.statusText}`,
    };
  } catch (err) {
    return { ok: false, error: `Mailketing tidak terjangkau: ${err instanceof Error ? err.message : String(err)}` };
  }
}
