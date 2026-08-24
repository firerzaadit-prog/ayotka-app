import "server-only";

/**
 * Tiket 4.4: timer server-side. mulai_at dipakai sebagai titik acuan
 * hitung mundur saat ini (bukan selalu waktu mulai attempt yang
 * sesungguhnya) - saat resume dari pause (Tiket 4.9), mulai_at direset ke
 * waktu resume supaya deadline = mulai_at + sisa_detik tetap sederhana dan
 * benar tanpa kolom tambahan untuk "total waktu terpakai".
 */
export function getDeadline(attempt: { mulaiAt: Date; sisaDetik: number }): Date {
  return new Date(attempt.mulaiAt.getTime() + attempt.sisaDetik * 1000);
}

export function getRemainingSeconds(attempt: { mulaiAt: Date; sisaDetik: number }): number {
  const remaining = Math.round((getDeadline(attempt).getTime() - Date.now()) / 1000);
  return Math.max(0, remaining);
}

export function isExpired(attempt: { mulaiAt: Date; sisaDetik: number }): boolean {
  return getRemainingSeconds(attempt) <= 0;
}
