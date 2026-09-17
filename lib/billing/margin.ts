import "server-only";
import { prisma } from "@/lib/db/prisma";

/**
 * Bagian D (permintaan user): margin keuntungan per transaksi Learning
 * Analytics tambahan, dapat diatur Admin Pusat lewat halaman Langganan.
 * Dibaca dari AppSetting.marginLearningAnalyticsPersen — default 20%.
 */
export async function getMarginPersen(): Promise<number> {
  const setting = await prisma.appSetting.findUnique({ where: { id: "global" } });
  return setting?.marginLearningAnalyticsPersen ?? 20;
}

/**
 * Hitung harga final Learning Analytics yang dibayar siswa =
 * hargaDasar x (1 + marginPersen/100), dibulatkan ke ratusan terdekat.
 */
export function computeHargaLA(hargaDasar: number, marginPersen: number): number {
  const raw = hargaDasar * (1 + marginPersen / 100);
  return Math.ceil(raw / 100) * 100;
}
