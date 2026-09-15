import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { runAnalisisAi } from "@/lib/ai/analyze";
import { tryStartProcessing, finishProcessing, setLastError } from "@/lib/ai/analysis-guard";
import { getAiAutoAnalysisSettings } from "@/lib/ai/settings";
import { hasReachedAutoAnalysisQuota } from "@/lib/ai/auto-trigger-quota";
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
 * Cuma berlaku untuk attempt yang selesai MULAI SEKARANG (keputusan user) -
 * tidak ada backfill attempt lama, karena fungsi ini cuma dipanggil dari
 * finalizeAttempt yang jalan di titik penyelesaian, bukan dijalankan mundur
 * ke data historis.
 */
export async function triggerAutoAnalysis(attempt: Attempt): Promise<void> {
  try {
    // Idempotent: finalizeAttempt bisa terpanggil lagi untuk attempt yang
    // sama (mis. race lazy-expiry-check) - jangan proses dobel kalau sudah
    // ada hasil analisisnya.
    const existing = await prisma.aiAnalysis.findUnique({
      where: { attemptId: attempt.id },
      select: { attemptId: true },
    });
    if (existing) return;

    const pkg = await prisma.package.findUnique({
      where: { id: attempt.packageId },
      select: { subjectId: true },
    });
    if (!pkg) return;

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

    if (!(await tryStartProcessing(attempt.id))) return;

    after(async () => {
      try {
        // Re-check quota di dalam after() sebagai authoritative check - mengatasi
        // race condition di Vercel multi-instance: dua instance bisa sama-sama lolos
        // optimistic check di luar (usedCount dihitung sebelum instance lain selesai
        // tulis aiAutoAnalysisAt). Check ulang di sini mempersempit window race
        // dari "antara check dan after()" menjadi "antara dua after() callback",
        // yang jauh lebih kecil dan hanya terjadi kalau dua attempt selesai
        // dalam waktu hampir bersamaan untuk siswa+mapel yang sama.
        const freshCount = await prisma.attempt.count({
          where: {
            studentId: attempt.studentId,
            aiAutoAnalysisAt: { not: null },
            package: { subjectId: pkg.subjectId },
          },
        });
        if (hasReachedAutoAnalysisQuota(freshCount, settings.aiAutoAnalysisMaxPerSubject)) {
          console.log(
            `[auto-trigger] quota terlampaui saat re-check (race condition), skip attempt ${attempt.id}`,
          );
          return; // finally block akan memanggil finishProcessing
        }

        await runAnalisisAi(attempt);
        await prisma.attempt.update({
          where: { id: attempt.id },
          data: { aiAutoAnalysisAt: new Date() },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[auto-trigger] gagal untuk attempt ${attempt.id}:`, err);
        await setLastError(attempt.id, message);
      } finally {
        await finishProcessing(attempt.id);
      }
    });
  } catch (err) {
    // Jaring pengaman: kegagalan di pengecekan jatah/pemicu ini sendiri
    // TIDAK BOLEH menggagalkan finalizeAttempt - siswa tetap harus bisa
    // submit dan lihat hasil ujiannya walau logika pemicu AI otomatis error.
    console.error(`[auto-trigger] gagal memeriksa/memicu untuk attempt ${attempt.id}:`, err);
  }
}
