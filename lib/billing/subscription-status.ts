import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Subscription } from "@prisma/client";

/** Bagian 7.1 brief: "3 hari setelah kedaluwarsa masih bisa akses penuh, lalu turun ke mode terbatas." */
const GRACE_PERIOD_DAYS = 3;

export type EffectiveStatus = "aktif" | "tenggang" | "kedaluwarsa" | "batal";

/**
 * Status langganan yang sesungguhnya SAAT INI, dihitung real-time dari
 * berakhir_at - tidak bergantung cron harian (Tiket 6.6) sudah jalan atau
 * belum, sama seperti pola lazy-expiry yang sudah dipakai untuk attempt
 * ujian (lib/exam/timing.ts).
 */
export function effectiveSubscriptionStatus(
  sub: Pick<Subscription, "status" | "berakhirAt">,
): EffectiveStatus {
  if (sub.status === "batal") return "batal";

  const now = Date.now();
  if (now <= sub.berakhirAt.getTime()) return "aktif";

  const graceEndsAt = sub.berakhirAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  return now <= graceEndsAt ? "tenggang" : "kedaluwarsa";
}

/** aktif & tenggang = akses penuh; kedaluwarsa/batal = "mulai ujian baru" terkunci (Bagian 7.1 brief). */
export function hasFullAccess(status: EffectiveStatus): boolean {
  return status === "aktif" || status === "tenggang";
}

/**
 * Subscription user yang masih bisa dipakai (aktif/tenggang) saat ini, kalau
 * ada. Ambil yang berakhir_at paling akhir supaya subscription lama yang
 * sudah kedaluwarsa tidak menutupi subscription baru yang masih berlaku.
 */
export async function getUsableSubscription(userId: string): Promise<Subscription | null> {
  const latest = await prisma.subscription.findFirst({
    where: { userId, status: { not: "batal" } },
    orderBy: { berakhirAt: "desc" },
  });
  if (!latest) return null;
  return hasFullAccess(effectiveSubscriptionStatus(latest)) ? latest : null;
}
