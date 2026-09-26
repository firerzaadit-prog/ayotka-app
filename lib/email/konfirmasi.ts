import { kirimEmail, type KirimEmailResult } from "@/lib/email/kirim";
import { escapeHtml } from "@/lib/utils/escape-html";

export type PeranKonfirmasi = "siswa" | "mitra";

const KONFIG: Record<PeranKonfirmasi, { subject: string; sapaan: string; next: string }> = {
  siswa: {
    subject: "Konfirmasi akun AyoTKA kamu",
    sapaan: "Terima kasih sudah mendaftar di AyoTKA.",
    next: "/siswa/dashboard",
  },
  mitra: {
    subject: "Konfirmasi akun Mitra AyoTKA kamu",
    sapaan: "Terima kasih sudah mendaftar sebagai mitra AyoTKA.",
    next: "/mitra/dashboard",
  },
};

/**
 * Dipakai bersama oleh pendaftaran (type "signup", token dari generateLink
 * saat akun dibuat) dan kirim ulang (type "magiclink" - terbukti lewat uji
 * langsung ke Supabase bahwa verifyOtp magiclink pada akun yang belum
 * terkonfirmasi ikut mengonfirmasi emailnya, dan berbeda dari "signup" tidak
 * butuh password asli siswa).
 */
export async function kirimEmailKonfirmasi(params: {
  email: string;
  nama: string;
  tokenHash: string;
  type: "signup" | "magiclink";
  peran: PeranKonfirmasi;
}): Promise<KirimEmailResult> {
  const konfig = KONFIG[params.peran];
  const confirmUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/confirm`);
  confirmUrl.searchParams.set("token_hash", params.tokenHash);
  confirmUrl.searchParams.set("type", params.type);
  confirmUrl.searchParams.set("next", konfig.next);
  const url = confirmUrl.toString();

  return kirimEmail({
    to: params.email,
    subject: konfig.subject,
    html: [
      `<p>Halo ${escapeHtml(params.nama)},</p>`,
      `<p>${konfig.sapaan} Klik tombol di bawah untuk mengonfirmasi akunmu:</p>`,
      `<p><a href="${url}" style="display:inline-block;padding:10px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">Konfirmasi Akun</a></p>`,
      `<p>Atau salin tautan ini ke browser: ${url}</p>`,
      `<p>Kalau kamu tidak merasa mendaftar di AyoTKA, abaikan saja email ini.</p>`,
    ].join(""),
  });
}

/** Pesan untuk layar pendaftar kalau akun sudah jadi tapi email belum terkirim. */
export function pesanEmailBelumTerkirim(kuotaHabis: boolean): string {
  return kuotaHabis
    ? "Akunmu sudah dibuat, tapi email konfirmasi belum bisa dikirim karena sistem email sedang sangat ramai. Coba klik \"Kirim ulang email konfirmasi\" beberapa menit lagi."
    : "Akunmu sudah dibuat, tapi email konfirmasi belum berhasil terkirim. Klik \"Kirim ulang email konfirmasi\" di bawah untuk mencoba lagi.";
}
