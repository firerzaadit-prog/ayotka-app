/**
 * Penyedia email CADANGAN (Mailketing, lokal Indonesia, prabayar Rp0,6/email)
 * - dipakai lib/email/kirim.ts hanya saat Resend menolak (kuota harian/
 * bulanan habis, 429, gangguan, API key kosong). Spesifikasi API: POST
 * https://api.mailketing.co.id/api/v2/send (JSON, header X-Api-Token,
 * respons "Email queued successfully" = sudah diterima antrean Mailketing).
 *
 * Dikonfigurasi lewat env (MAILKETING_API_TOKEN, MAILKETING_FROM_EMAIL) -
 * kalau token kosong, penyedia ini dianggap MATI (bukan error) dan
 * kirim.ts cuma memakai Resend seperti sebelumnya.
 *
 * Bounce dikenai penalti kredit di Mailketing (30 kredit per email bounce),
 * itulah alasan modul ini sengaja HANYA jalur cadangan, bukan utama.
 *
 * Tanpa "server-only": sama seperti lib/email/resend.ts, cuma membaca
 * process.env saat runtime.
 */

export type SendViaMailketingInput = { to: string; subject: string; html: string };
export type SendViaMailketingResult =
  | { ok: true }
  | { ok: false; error: string; status?: number };

const ENDPOINT = "https://api.mailketing.co.id/api/v2/send";
const DEFAULT_FROM = "AyoTKA <noreply@ayotka.id>";

export function mailketingTersedia(): boolean {
  return Boolean(process.env.MAILKETING_API_TOKEN);
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
  const token = process.env.MAILKETING_API_TOKEN;
  if (!token) {
    return { ok: false, error: "MAILKETING_API_TOKEN belum diisi di .env" };
  }
  const pengirim = parseAlamatPengirim(process.env.MAILKETING_FROM_EMAIL || DEFAULT_FROM);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Token": token },
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
