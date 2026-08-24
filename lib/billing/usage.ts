import "server-only";
import { prisma } from "@/lib/db/prisma";
import { periodeBulanWIB } from "@/lib/utils/datetime";

/**
 * Tiket 6.11 (Bagian 7.1 brief, "Batas wajar (fair use)"): usage_counters
 * MURNI untuk monitoring - "tanpa batas wajar, biaya AI jadi murni
 * bergantung pemakaian nyata... disarankan admin pusat memantau
 * usage_counters secara berkala untuk mendeteksi pemakaian ekstrem lebih
 * awal - bukan sebagai pembatas otomatis". Jangan pernah dipakai untuk
 * menolak permintaan siswa, cuma dicatat.
 */
export async function incrementAttemptUsage(userId: string, now: Date = new Date()): Promise<void> {
  const periodeBulan = periodeBulanWIB(now);
  await prisma.usageCounter.upsert({
    where: { userId_periodeBulan: { userId, periodeBulan } },
    create: { userId, periodeBulan, jmlAttempt: 1 },
    update: { jmlAttempt: { increment: 1 } },
  });
}

export async function incrementAnalisisAiUsage(userId: string, now: Date = new Date()): Promise<void> {
  const periodeBulan = periodeBulanWIB(now);
  await prisma.usageCounter.upsert({
    where: { userId_periodeBulan: { userId, periodeBulan } },
    create: { userId, periodeBulan, jmlAnalisisAi: 1 },
    update: { jmlAnalisisAi: { increment: 1 } },
  });
}
