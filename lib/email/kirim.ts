import { sendViaResendApi, type SendViaResendInput } from "@/lib/email/resend";
import { mailketingTersedia, sendViaMailketingApi } from "@/lib/email/mailketing";
import { gabungKode, KODE_MAILKETING_NONAKTIF, kodeGalatMailketing, kodeGalatResend } from "@/lib/email/kode-galat";

export type KirimEmailResult =
  | { ok: true; lewat: "resend" | "mailketing" }
  /** kode = penyebab singkat yang aman ditampilkan/dicatat (lihat lib/email/kode-galat.ts), mis. "resend-401 + mailketing-nonaktif". */
  | { ok: false; error: string; kuotaHabis: boolean; kode: string };

/**
 * Pintu tunggal pengiriman email transaksional (konfirmasi pendaftaran,
 * reset password). SELALU mencoba Resend dulu (gratis, utama); Mailketing
 * cuma dipakai kalau Resend gagal karena sebab yang masuk akal dicadangkan -
 * kuota habis, 429, gangguan 5xx/jaringan, API key/domain bermasalah. Begitu
 * kuota Resend kembali, pengiriman berikutnya otomatis kembali lewat Resend
 * (tidak ada status "sedang pakai cadangan" yang perlu di-reset).
 *
 * Alamat penerima yang ditolak Resend sebagai tidak valid (400/422) TIDAK
 * dicadangkan: Mailketing akan gagal/bounce juga, dan bounce di sana
 * dikenai penalti kredit.
 */
export async function kirimEmail(input: SendViaResendInput): Promise<KirimEmailResult> {
  const resend = await sendViaResendApi(input);
  if (resend.ok) return { ok: true, lewat: "resend" };

  const penerimaDitolak = resend.status === 400 || resend.status === 422;
  if (penerimaDitolak || !(await mailketingTersedia())) {
    return {
      ok: false,
      error: resend.error,
      kuotaHabis: resend.kuotaHabis,
      kode: gabungKode(kodeGalatResend(resend), penerimaDitolak ? null : KODE_MAILKETING_NONAKTIF),
    };
  }

  console.warn(`[email] Resend gagal (${resend.error}), mencoba Mailketing.`);
  const cadangan = await sendViaMailketingApi(input);
  if (cadangan.ok) return { ok: true, lewat: "mailketing" };

  return {
    ok: false,
    error: `${resend.error} | ${cadangan.error}`,
    // Kuota habis hanya jujur dilaporkan kalau cadangan pun tidak menolong.
    kuotaHabis: resend.kuotaHabis,
    kode: gabungKode(kodeGalatResend(resend), kodeGalatMailketing(cadangan)),
  };
}
