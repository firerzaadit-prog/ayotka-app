/**
 * Alamat pengirim email harus berformat "email@domain.com" atau
 * "Nama <email@domain.com>" - Resend menolak selain itu dengan HTTP 422.
 * Penyebab paling umum: nilai yang di-paste ke Pengaturan Sistem masih
 * membawa tanda kutip pembungkus (mis. "AyoTKA <noreply@ayotka.id>"),
 * karena disalin dari baris .env. Fungsi ini membuang kutip pembungkus dan
 * memvalidasi bentuknya; null berarti tidak valid.
 */
export const DEFAULT_FROM_ADDRESS = "AyoTKA <noreply@ayotka.id>";

const PLAIN = /^[^\s<>@"]+@[^\s<>@"]+\.[^\s<>@"]+$/;
const NAMED = /^[^<>]+<[^\s<>@"]+@[^\s<>@"]+\.[^\s<>@"]+>$/;

export function normalizeFromAddress(raw: string | null | undefined): string | null {
  let value = (raw ?? "").trim();
  while (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }
  return PLAIN.test(value) || NAMED.test(value) ? value : null;
}

/** Pilih kandidat valid pertama (database dulu, lalu env); kalau semuanya rusak, pakai bawaan supaya email tetap terkirim. */
export function resolveFromAddress(...candidates: Array<string | null | undefined>): string {
  for (const c of candidates) {
    const ok = normalizeFromAddress(c);
    if (ok) return ok;
  }
  return DEFAULT_FROM_ADDRESS;
}
