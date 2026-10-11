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
 * Alamat dasar tautan konfirmasi di email. NEXT_PUBLIC_APP_URL wajib di produksi: tanpa itu tautan di email mengarah ke
 * alamat yang salah, jadi lebih baik pengiriman dibatalkan dengan kode yang jelas (null) daripada mengirim tautan rusak
 * atau melempar galat setelah akun terlanjur dibuat. Di luar produksi (dev/tes) dipakai http://localhost:3000.
 */
function tautanKonfirmasi(): URL | null {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const dasar = env || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  try {
    return new URL(`${dasar.replace(/\/+$/, "")}/api/auth/confirm`);
  } catch {
    return null;
  }
}

/**
 * Dipakai bersama oleh pendaftaran (type "signup", token dari generateLink
 * saat akun dibuat) dan kirim ulang (type "magiclink" - terbukti lewat uji
 * langsung ke Supabase bahwa verifyOtp magiclink pada akun yang belum
 * terkonfirmasi ikut mengonfirmasi emailnya, dan berbeda dari "signup" tidak
 * butuh password asli siswa).
 */
export async function kirimEmailKonfirmasi(params: ParamKonfirmasi): Promise<KirimEmailResult> {
  try {
    return await bangunDanKirim(params);
  } catch (err) {
    // Dipanggil SETELAH akun dibuat (pendaftaran) atau saat kirim ulang: galat tak terduga di sini tidak boleh menjadi
    // 500 ke layar pendaftar. Akunnya sudah ada; cukup tampilkan pesan "belum terkirim" beserta kodenya.
    console.error("[konfirmasi] galat tak terduga saat menyiapkan atau mengirim email:", err);
    return { ok: false, error: "Galat tak terduga saat mengirim email konfirmasi", kuotaHabis: false, kode: "email-galat-tak-terduga" };
  }
}

type ParamKonfirmasi = {
  email: string;
  nama: string;
  tokenHash: string;
  type: "signup" | "magiclink";
  peran: PeranKonfirmasi;
};

async function bangunDanKirim(params: ParamKonfirmasi): Promise<KirimEmailResult> {
  const konfig = KONFIG[params.peran];
  const confirmUrl = tautanKonfirmasi();
  if (!confirmUrl) {
    return {
      ok: false,
      error: "NEXT_PUBLIC_APP_URL belum diisi atau bukan alamat yang sah, tautan konfirmasi tidak bisa dibuat",
      kuotaHabis: false,
      kode: "app-url-tidak-valid",
    };
  }
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

/**
 * Pesan untuk layar pendaftar kalau akun sudah jadi tapi email belum terkirim. `kode` (lib/email/kode-galat.ts) ditambahkan
 * di ujung supaya penyebabnya langsung terlihat saat dilaporkan, tanpa harus membuka log server.
 */
export function pesanEmailBelumTerkirim(kuotaHabis: boolean, kode?: string): string {
  const dasar = kuotaHabis
    ? "Akunmu sudah dibuat, tapi email konfirmasi belum bisa dikirim karena sistem email sedang sangat ramai. Coba klik \"Kirim ulang email konfirmasi\" beberapa menit lagi."
    : "Akunmu sudah dibuat, tapi email konfirmasi belum berhasil terkirim. Klik \"Kirim ulang email konfirmasi\" di bawah untuk mencoba lagi.";
  return kode ? `${dasar} (Kode: ${kode})` : dasar;
}
