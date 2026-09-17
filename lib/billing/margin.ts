import "server-only";
import { prisma } from "@/lib/db/prisma";

export async function getMarginPersen(): Promise<number> {
  const setting = await prisma.appSetting.findUnique({ where: { id: "global" } });
  return setting?.marginLearningAnalyticsPersen ?? 20;
}

export function computeHargaLA(hargaDasar: number, marginPersen: number): number {
  const raw = hargaDasar * (1 + marginPersen / 100);
  return Math.ceil(raw / 100) * 100;
}