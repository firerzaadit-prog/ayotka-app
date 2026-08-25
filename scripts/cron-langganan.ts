/**
 * Tiket 6.6 + 6.9 — cron harian langganan siswa mandiri:
 *   1. Transisi status (aktif -> tenggang -> kedaluwarsa, masa tenggang 3
 *      hari sesuai Bagian 7.1 brief).
 *   2. Kirim email pengingat H-7/H-3/H-0 sebelum kedaluwarsa (butuh
 *      EMAIL_SMTP_* terisi di .env - kalau belum, dilewati dengan
 *      peringatan, bukan error, supaya transisi status tetap jalan).
 *
 * Jalankan tiap hari lewat cron/scheduler di server produksi:
 *
 *   npx tsx scripts/cron-langganan.ts   (atau: npm run cron:langganan)
 *
 * PENTING: jalankan MAKSIMAL SEKALI SEHARI. Transisi status aman
 * dijalankan berkali-kali (idempotent - baris yang sudah pindah status
 * tidak match lagi ke kondisi where-nya), tapi pengiriman email TIDAK ada
 * penanda "sudah terkirim" di DB - jalankan lebih dari sekali di hari yang
 * sama akan mengirim reminder yang sama dobel ke siswa.
 *
 * Untuk uji manual (kriteria selesai tiket 6.6): ubah berakhir_at sebuah
 * subscription ke masa lalu langsung di DB, lalu jalankan skrip ini -
 * statusnya harus berubah sesuai aturan tenggang 3 hari.
 */
import { PrismaClient } from "@prisma/client";
import { transitionSubscriptionStatuses } from "@/lib/billing/cron";
import { sendDueBillingReminders } from "@/lib/billing/reminder-cron";
import { sendMail } from "@/lib/email/mailer";

const prisma = new PrismaClient();

async function main() {
  const transisi = await transitionSubscriptionStatuses(prisma);
  console.log(
    `Transisi langganan selesai: ${transisi.keTenggang} ke tenggang, ${transisi.keKedaluwarsa} ke kedaluwarsa.`,
  );

  const reminder = await sendDueBillingReminders(prisma, sendMail);
  console.log(
    `Email pengingat billing: ${reminder.terkirim} terkirim, ${reminder.dilewati} dilewati (SMTP belum dikonfigurasi atau gagal kirim).`,
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
