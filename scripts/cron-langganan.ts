/**
 * Tiket 6.6 — transisi harian status langganan siswa mandiri
 * (aktif -> tenggang -> kedaluwarsa, masa tenggang 3 hari sesuai Bagian 7.1
 * brief). Jalankan tiap hari lewat cron/scheduler di server produksi:
 *
 *   npx tsx scripts/cron-langganan.ts
 *
 * Untuk uji manual (kriteria selesai tiket ini): ubah berakhir_at sebuah
 * subscription ke masa lalu langsung di DB, lalu jalankan skrip ini -
 * statusnya harus berubah sesuai aturan tenggang 3 hari.
 */
import { PrismaClient } from "@prisma/client";
import { transitionSubscriptionStatuses } from "@/lib/billing/cron";

const prisma = new PrismaClient();

async function main() {
  const result = await transitionSubscriptionStatuses(prisma);
  console.log(
    `Transisi langganan selesai: ${result.keTenggang} ke tenggang, ${result.keKedaluwarsa} ke kedaluwarsa.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
