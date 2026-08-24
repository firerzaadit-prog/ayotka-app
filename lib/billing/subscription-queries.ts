import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Subscription } from "@prisma/client";
import { effectiveSubscriptionStatus, hasFullAccess } from "@/lib/billing/subscription-status";

/**
 * Subscription user yang paling relevan (berakhir_at paling akhir, supaya
 * subscription lama yang sudah kedaluwarsa tidak menutupi subscription baru
 * yang masih berlaku) - terlepas dari statusnya efektif masih berlaku atau
 * tidak. Dipakai untuk tampilan status ("langganan berakhir tanggal ...").
 */
export async function getLatestSubscription(userId: string): Promise<Subscription | null> {
  return prisma.subscription.findFirst({
    where: { userId, status: { not: "batal" } },
    orderBy: { berakhirAt: "desc" },
  });
}

/** Subscription user yang masih bisa dipakai (status efektif aktif/tenggang) saat ini, kalau ada. */
export async function getUsableSubscription(userId: string): Promise<Subscription | null> {
  const latest = await getLatestSubscription(userId);
  if (!latest) return null;
  return hasFullAccess(effectiveSubscriptionStatus(latest)) ? latest : null;
}
