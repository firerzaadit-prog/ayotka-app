import "server-only";
import type { Attempt } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isProcessing } from "@/lib/ai/analysis-guard";
import { getAiAutoAnalysisSettings } from "@/lib/ai/settings";
import { hasReachedAutoAnalysisQuota } from "@/lib/ai/auto-trigger-quota";
import { tentukanPendanaanAttempt } from "@/lib/billing/pendanaan-la";
import { getHargaLearningAnalytics, getSaldo } from "@/lib/billing/saldo";
import type { OpsiLaSusulan } from "@/lib/billing/learning-analytics";

/**
 * Opsi Learning Analytics SUSULAN untuk satu percobaan milik siswa: bisa tidaknya dijalankan sekarang, dengan apa
 * dibayarnya (jatah paket atau saldo), dan apakah cukup. Hanya MEMBACA - tidak mendebit apa pun; pendebitan terjadi di
 * pemroses (lib/ai/queue-worker.ts) tepat sebelum analisis dijalankan, dengan aturan yang sama
 * (lib/billing/pendanaan-la.ts), sehingga yang ditampilkan di tombol = yang benar-benar terjadi.
 */
export async function hitungOpsiLaSusulan(attempt: Attempt): Promise<OpsiLaSusulan> {
  if (attempt.status !== "selesai" && attempt.status !== "kedaluwarsa") {
    return { tersedia: false, alasan: "belum_selesai" };
  }
  const analisis = await prisma.aiAnalysis.findUnique({ where: { attemptId: attempt.id }, select: { attemptId: true } });
  if (analisis) return { tersedia: false, alasan: "sudah_ada" };
  if (attempt.aiAnalysisQueuedAt || isProcessing(attempt.aiAnalysisProcessingAt)) {
    return { tersedia: false, alasan: "sedang_diproses" };
  }

  const pkg = await prisma.package.findUniqueOrThrow({
    where: { id: attempt.packageId },
    select: { subjectId: true, kategori: true },
  });
  // Try Out Nasional sudah termasuk Learning Analytics otomatis (dibundel) - tidak ada yang bisa "dibeli" susulan.
  if (pkg.kategori === "nasional") return { tersedia: false, alasan: "nasional" };

  const dana = await tentukanPendanaanAttempt(attempt, pkg);
  if (dana.pendanaan === "kuota") {
    const [settings, terpakai] = await Promise.all([
      getAiAutoAnalysisSettings(),
      prisma.attempt.count({
        where: { studentId: attempt.studentId, aiAutoAnalysisAt: { not: null }, package: { subjectId: pkg.subjectId } },
      }),
    ]);
    return {
      tersedia: true,
      pendanaan: "kuota",
      kuotaSisa: dana.kuotaSisa,
      batasTercapai: hasReachedAutoAnalysisQuota(terpakai, settings.aiAutoAnalysisMaxPerSubject),
      batasMaks: settings.aiAutoAnalysisMaxPerSubject,
    };
  }

  const [saldo, harga] = await Promise.all([getSaldo(attempt.studentId), getHargaLearningAnalytics()]);
  return { tersedia: true, pendanaan: "saldo", harga, saldo, cukup: saldo >= harga, kurang: Math.max(0, harga - saldo) };
}
