import { resolveFromAddress } from "@/lib/email/from-address";

/**
 * Keputusan murni "kunci Resend mana yang dipakai" (dipisah dari lib/settings/app-settings.ts supaya bisa dites tanpa
 * database). Aturannya: kunci yang disimpan admin di Pengaturan Sistem (database) didahulukan, lalu RESEND_API_KEY dari .env.
 *
 * Dua kegagalan senyap yang dulu membuat semua email berhenti tanpa petunjuk, dan kini ditangani di sini:
 * 1. Kunci di database sudah tidak valid (dicabut/diganti di Resend) padahal RESEND_API_KEY di .env masih valid. Kunci
 *    .env disimpan sebagai `kunciCadanganEnv` supaya pengirim (lib/email/resend.ts) bisa mencobanya bila Resend menolak
 *    kunci database dengan 401/403.
 * 2. Kunci di database ada tetapi tidak bisa didekripsi (mis. APP_ENCRYPTION_KEY / SUPABASE_SERVICE_ROLE_KEY server
 *    berbeda dari saat kunci disimpan, seperti saat pindah server). Dekripsi gagal diam-diam menjadi "", dulu terlihat
 *    sama persis dengan "belum diisi". Sekarang ditandai `kunciDatabaseTakTerbaca`.
 */
export type SumberKonfigResend = "database" | "env" | "none";

export type KonfigResend = {
  apiKey: string;
  fromEmail: string;
  source: SumberKonfigResend;
  /** Kunci dari .env yang BERBEDA dari kunci database; hanya ada bila kunci utama berasal dari database. */
  kunciCadanganEnv?: string;
  /** Ada kunci tersimpan di database tetapi tidak bisa dibaca, sehingga yang dipakai (kalau ada) kunci .env. */
  kunciDatabaseTakTerbaca?: boolean;
};

export function tentukanKonfigResend(p: {
  /** Kolom terenkripsi di database berisi sesuatu. */
  dbTersimpan: boolean;
  /** Hasil dekripsi kolom itu ("" bila kosong atau gagal didekripsi). */
  dbKunci: string;
  dbFrom: string | null | undefined;
  envKunci: string | undefined;
  envFrom: string | undefined;
}): KonfigResend {
  const envKunci = (p.envKunci ?? "").trim();

  if (p.dbKunci) {
    return {
      apiKey: p.dbKunci,
      fromEmail: resolveFromAddress(p.dbFrom, p.envFrom),
      source: "database",
      ...(envKunci && envKunci !== p.dbKunci ? { kunciCadanganEnv: envKunci } : {}),
    };
  }

  return {
    apiKey: envKunci,
    fromEmail: resolveFromAddress(p.envFrom),
    source: envKunci ? "env" : "none",
    ...(p.dbTersimpan ? { kunciDatabaseTakTerbaca: true } : {}),
  };
}
