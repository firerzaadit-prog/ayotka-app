import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getAiAutoAnalysisSettings } from "@/lib/ai/settings";
import { hasReachedAutoAnalysisQuota } from "@/lib/ai/auto-trigger-quota";
import { wasAttemptFreeTrial } from "@/lib/billing/entitlements";
import type { Attempt } from "@prisma/client";

/**
 * Keputusan user (menggantikan keputusan lama Tiket 5.3 "manual-only"):
 * setiap attempt selesai/kedaluwarsa otomatis memicu analisis AI, dipanggil
 * dari finalizeAttempt supaya konsisten lintas semua jalur penyelesaian
 * (submit manual maupun auto-expiry). Dibatasi jatah GLOBAL yang admin pusat
 * atur lewat UI (lihat lib/ai/settings.ts) - "maksimal N kali analisis
 * OTOMATIS per siswa per mata pelajaran", independen dari kuota attempt
 * (entitlements — lib/billing/entitlements.ts) supaya biaya Gemini tetap
 * terjamin terkendali apa pun kondisi kuota attempt-nya. Tombol manual admin pusat/
 * sekolah (app/api/attempts/[id]/analisis-ai/route.ts) SENGAJA tidak lewat
 * fungsi ini - itu tetap tanpa batas seperti sebelumnya.
 *
 * PENTING (revisi skala Try Out Nasional): fungsi ini DULU langsung memanggil
 * Gemini lewat after() begitu lolos semua gerbang di bawah - aman untuk
 * puluhan/ratusan attempt selesai berdekatan, tapi kalau ribuan siswa
 * selesai bersamaan (Try Out Nasional), itu jadi ribuan panggilan Gemini
 * serentak tanpa kendali laju sama sekali (fire-and-forget massal). Sekarang
 * fungsi ini HANYA menandai attempt "masuk antrean" (aiAnalysisQueuedAt) -
 * yang benar-benar memanggil Gemini adalah lib/ai/queue-worker.ts, dipicu
 * cron tiap menit (app/api/cron/proses-antrean-ai), dengan laju panggilan
 * dibatasi. Semua pengecekan gerbang (jatah, free trial, dst.) tetap di sini
 * karena murah (baca DB saja) dan supaya attempt yang jelas tidak berhak
 * tidak usah masuk antrean sama sekali.
 *
 * Rincian Biaya AyoTKA (keputusan produk): free trial TIDAK mendapat
 * Analisis AI sama sekali - hanya skor + peta kompetensi (lihat
 * app/siswa/hasil/[id]/page.tsx untuk teaser blur yang ditampilkan
 * sebagai gantinya). Biaya Gemini jadi nol untuk siapa pun yang belum bayar,
 * berapa pun jumlahnya.
 *
 * Cuma berlaku untuk attempt yang selesai MULAI SEKARANG (keputusan user) -
 * tidak ada backfill attempt lama, karena fungsi ini cuma dipanggil dari
 * finalizeAttempt yang jalan di titik penyelesaian, bukan dijalankan mundur
 * ke data historis.
 */
export async function triggerAutoAnalysis(attempt: Attempt): Promise<void> {
  try {
    // Idempotent: finalizeAttempt bisa terpanggil lagi untuk attempt yang
    // sama (mis. race lazy-expiry-check) - jangan masuk antrean dobel kalau
    // sudah ada hasil analisisnya (atau sudah di antrean/diproses).
    const existing = await prisma.aiAnalysis.findUnique({
      where: { attemptId: attempt.id },
      select: { attemptId: true },
    });
    if (existing) return;
    if (attempt.aiAnalysisQueuedAt || attempt.aiAnalysisProcessingAt) return;

    const pkg = await prisma.package.findUnique({
      where: { id: attempt.packageId },
      select: { subjectId: true, jenisPaket: true },
    });
    if (!pkg) return;

    // Bagian 8/10 (permintaan user): paket Latihan tidak pernah dianalisis
    // AI, berlaku di semua jalur - independen dari status free-trial/
    // berlangganan di bawah ini.
    if (pkg.jenisPaket === "latihan") return;

    // Bagian D/G (permintaan user): sejak Learning Analytics jadi opt-in
    // berbayar (jatah plan atau saldo, lihat app/api/siswa/attempts/route.ts
    // untuk resolusi & validasi awalnya), attempt yang siswanya tidak
    // meminta LA (atau free trial - selalu false, aturan lama tetap
    // berlaku) tidak pernah dianalisis di sini sama sekali.
    if (!attempt.analisisAiDiminta) return;
    if (await wasAttemptFreeTrial(attempt.studentId, attempt.mulaiAt)) return;

    const settings = await getAiAutoAnalysisSettings();
    const usedCount = await prisma.attempt.count({
      where: {
        studentId: attempt.studentId,
        aiAutoAnalysisAt: { not: null },
        package: { subjectId: pkg.subjectId },
      },
    });
    if (hasReachedAutoAnalysisQuota(usedCount, settings.aiAutoAnalysisMaxPerSubject)) {
      return;
    }

    // Masuk antrean. Jatah dicek ULANG oleh queue-worker tepat sebelum
    // memanggil Gemini (baris terakhir, sama seperti pola lama) - ini cuma
    // gerbang optimistic di titik penyelesaian ujian, bukan keputusan akhir,
    // karena bisa berjam-jam berlalu antara masuk antrean dan benar-benar
    // diproses saat backlog sedang panjang.
    await prisma.attempt.update({
      where: { id: attempt.id },
      data: { aiAnalysisQueuedAt: new Date(), aiAnalysisLastError: null },
    });
  } catch (err) {
    // Jaring pengaman: kegagalan di pengecekan jatah/pemicu ini sendiri
    // TIDAK BOLEH menggagalkan finalizeAttempt - siswa tetap harus bisa
    // submit dan lihat hasil ujiannya walau logika pemicu AI otomatis error.
    console.error(`[auto-trigger] gagal memeriksa/memicu untuk attempt ${attempt.id}:`, err);
  }
}
