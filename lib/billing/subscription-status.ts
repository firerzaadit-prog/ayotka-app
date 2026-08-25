import type { Subscription } from "@prisma/client";

/**
 * Bagian 7.1 brief: "3 hari setelah kedaluwarsa masih bisa akses penuh,
 * lalu turun ke mode terbatas." Modul ini sengaja murni (tanpa "server-only"
 * / akses prisma langsung, beda dari lib/billing/subscription-queries.ts)
 * supaya bisa dipakai baik dari route API maupun skrip cron mandiri
 * (scripts/cron-langganan.ts) - sama seperti pemisahan
 * lib/exam/scoring.ts (murni) vs lib/exam/finalize.ts (akses DB).
 */
export const GRACE_PERIOD_DAYS = 3;

export type EffectiveStatus = "aktif" | "tenggang" | "kedaluwarsa" | "batal";

/**
 * Status langganan yang sesungguhnya SAAT INI, dihitung real-time dari
 * berakhir_at - tidak bergantung cron harian (Tiket 6.6) sudah jalan atau
 * belum, sama seperti pola lazy-expiry yang sudah dipakai untuk attempt
 * ujian (lib/exam/timing.ts).
 */
export function effectiveSubscriptionStatus(
  sub: Pick<Subscription, "status" | "berakhirAt">,
  now: Date = new Date(),
): EffectiveStatus {
  if (sub.status === "batal") return "batal";

  const nowMs = now.getTime();
  if (nowMs <= sub.berakhirAt.getTime()) return "aktif";

  const graceEndsAt = sub.berakhirAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  return nowMs <= graceEndsAt ? "tenggang" : "kedaluwarsa";
}

/** aktif & tenggang = akses penuh; kedaluwarsa/batal = "mulai ujian baru" terkunci (Bagian 7.1 brief). */
export function hasFullAccess(status: EffectiveStatus): boolean {
  return status === "aktif" || status === "tenggang";
}

/**
 * Tiket 6.7 (Bagian 5 brief): "masa aktif bertambah dari tanggal berakhir
 * sebelumnya" - kalau subscription yang ada masih usable (aktif/tenggang)
 * saat order di-ACC, periode baru MULAI dari berakhir_at yang lama supaya
 * sisa masa aktif yang belum terpakai tidak hilang. Kalau tidak usable
 * (belum pernah langganan, atau sudah lama kedaluwarsa lewat masa
 * tenggang), periode baru mulai dari sekarang - memulai dari tanggal
 * kedaluwarsa yang sudah lama lewat akan merugikan siswa (sebagian besar
 * periode barunya langsung habis).
 */
export function computeRenewalPeriod(
  currentSub: Pick<Subscription, "status" | "berakhirAt"> | null,
  durasiHari: number,
  now: Date = new Date(),
): { mulaiAt: Date; berakhirAt: Date; isRenewal: boolean } {
  const isRenewal = currentSub != null && hasFullAccess(effectiveSubscriptionStatus(currentSub, now));
  const mulaiAt = isRenewal ? currentSub!.berakhirAt : now;
  const berakhirAt = new Date(mulaiAt.getTime() + durasiHari * 24 * 60 * 60 * 1000);
  return { mulaiAt, berakhirAt, isRenewal };
}
