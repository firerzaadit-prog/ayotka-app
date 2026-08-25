import type { PrismaClient } from "@prisma/client";
import { GRACE_PERIOD_DAYS } from "@/lib/billing/subscription-status";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Tiket 6.6: transisi status subscription (aktif -> tenggang -> kedaluwarsa)
 * berdasarkan berakhir_at, ditulis ke kolom status di DB. Gating akses
 * (Tiket 6.5) sendiri sudah lazy real-time lewat effectiveSubscriptionStatus
 * dan TIDAK bergantung cron ini sudah jalan atau belum - cron ini untuk
 * tempat lain yang baca kolom status apa adanya (listing, dan tiket 6.9
 * email reminder H-0 yang perlu tahu siapa yang baru saja kedaluwarsa).
 *
 * Terima `prisma` sebagai parameter (bukan import singleton langsung)
 * supaya modul ini TIDAK butuh "server-only" - dengan begitu bisa dipanggil
 * baik dari route API (pakai lib/db/prisma) maupun skrip cron mandiri
 * scripts/cron-langganan.ts (pakai PrismaClient sendiri), sesuai kriteria
 * tiket ("jalankan cron manual").
 *
 * Urutan penting: transisi ke kedaluwarsa dijalankan LEBIH DULU, baru
 * tenggang. Kalau dibalik, subscription yang lompat langsung dari aktif ke
 * kedaluwarsa (mis. cron sempat tidak jalan beberapa hari, atau berakhir_at
 * diubah manual jauh ke masa lalu untuk testing) akan tersentuh update
 * tenggang lebih dulu lalu ditimpa lagi oleh update kedaluwarsa - hasil
 * akhir di DB tetap benar, tapi count yang dikembalikan jadi salah hitung
 * (dobel). Kedaluwarsa dulu menghindari itu sekaligus.
 */
export async function transitionSubscriptionStatuses(
  prisma: Pick<PrismaClient, "subscription">,
  now: Date = new Date(),
): Promise<{ keTenggang: number; keKedaluwarsa: number }> {
  const graceThreshold = new Date(now.getTime() - GRACE_PERIOD_DAYS * DAY_MS);

  const keKedaluwarsa = await prisma.subscription.updateMany({
    where: { status: { in: ["aktif", "tenggang"] }, berakhirAt: { lte: graceThreshold } },
    data: { status: "kedaluwarsa" },
  });

  const keTenggang = await prisma.subscription.updateMany({
    where: { status: "aktif", berakhirAt: { lte: now } },
    data: { status: "tenggang" },
  });

  return { keKedaluwarsa: keKedaluwarsa.count, keTenggang: keTenggang.count };
}
