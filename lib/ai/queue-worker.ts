import "server-only";
import { prisma } from "@/lib/db/prisma";
import { runAnalisisAi } from "@/lib/ai/analyze";
import { tryStartProcessing, finishProcessing, setLastError, STALE_MS } from "@/lib/ai/analysis-guard";
import { getAiAutoAnalysisSettings } from "@/lib/ai/settings";
import { hasReachedAutoAnalysisQuota } from "@/lib/ai/auto-trigger-quota";
import { getAiKuotaRemaining } from "@/lib/billing/plan-fitur";
import { debitSaldoUntukAnalisis, getHargaLearningAnalytics } from "@/lib/billing/saldo";
import { runWithRateLimit } from "@/lib/utils/rate-limited-dispatch";
import type { AnalisisSumber } from "@prisma/client";

/**
 * Laju MAKSIMUM panggilan Gemini yang DIMULAI per detik, berapa pun
 * banyaknya attempt yang menunggu di antrean - inilah yang menggantikan
 * fire-and-forget lama (lihat lib/ai/auto-trigger.ts). Angka kecil dengan
 * sengaja: Gemini API sendiri punya rate limit per-project, dan biaya
 * per-panggilan nyata - lebih baik antrean mengular beberapa menit saat
 * puncak Try Out Nasional daripada memicu 429 massal atau tagihan meledak.
 * Ubah lewat env var kalau kuota Gemini project sudah dinaikkan.
 */
const RATE_PER_SECOND = Number(process.env.AI_QUEUE_RATE_PER_SECOND) || 3;
/** Jaring pengaman jumlah panggilan Gemini yang boleh berlangsung BERSAMAAN (retry Gemini bisa puluhan detik). */
const MAX_CONCURRENT = Number(process.env.AI_QUEUE_MAX_CONCURRENT) || 8;
/** Diambil generous per pemanggilan cron - laju di atas yang membatasi throughput sungguhan, bukan angka ini. */
const BATCH_SIZE = 500;

const DISPATCH_INTERVAL_MS = 1000 / RATE_PER_SECOND;

export type HasilProsesSatu = "selesai" | "gagal" | "dilewati";
export type HasilProsesAntrean = { diklaim: number; selesai: number; gagal: number; dilewati: number };

/**
 * Proses SATU attempt yang sudah berhasil diklaim (tryStartProcessing sudah
 * dipanggil pemanggil - lihat processAiQueue). Mengulang persis urutan lama
 * di lib/ai/auto-trigger.ts: re-check jatah (authoritative, bukan optimistic)
 * lalu tentukan sumber pendanaan (kuota/saldo) TEPAT sebelum memanggil
 * Gemini - supaya kalau attempt ternyata harus dilewati, saldo siswa tidak
 * pernah terlanjur didebit.
 */
async function processOne(attemptId: string): Promise<HasilProsesSatu> {
  try {
    const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt) return "dilewati";

    const pkg = await prisma.package.findUnique({
      where: { id: attempt.packageId },
      select: { subjectId: true, kategori: true, subject: { select: { nama: true } } },
    });
    if (!pkg) return "dilewati";

    const settings = await getAiAutoAnalysisSettings();
    const freshCount = await prisma.attempt.count({
      where: {
        studentId: attempt.studentId,
        aiAutoAnalysisAt: { not: null },
        package: { subjectId: pkg.subjectId },
      },
    });
    if (hasReachedAutoAnalysisQuota(freshCount, settings.aiAutoAnalysisMaxPerSubject)) {
      console.log(`[queue-worker] jatah terlampaui saat diproses, skip attempt ${attemptId}`);
      return "dilewati";
    }

    // Try Out Nasional selalu dibundel (sumber "kuota", tidak pernah didebit)
    // - lihat lib/billing/plan-fitur.ts.
    let sumber: AnalisisSumber = "kuota";
    if (pkg.kategori !== "nasional") {
      const kuota = await getAiKuotaRemaining(attempt.studentId, pkg.subjectId);
      if (kuota && kuota.sisa > 0) {
        sumber = "kuota";
      } else {
        const harga = await getHargaLearningAnalytics();
        const debited = await debitSaldoUntukAnalisis({
          studentId: attempt.studentId,
          attemptId: attempt.id,
          subjectNama: pkg.subject.nama,
          harga,
        });
        if (!debited) {
          console.warn(`[queue-worker] saldo tidak cukup saat diproses untuk attempt ${attemptId}, LA dilewati`);
          return "dilewati";
        }
        sumber = "saldo";
      }
    }

    await runAnalisisAi(attempt, sumber);
    await prisma.attempt.update({
      where: { id: attempt.id },
      data: { aiAutoAnalysisAt: new Date() },
    });
    return "selesai";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[queue-worker] gagal untuk attempt ${attemptId}:`, err);
    await setLastError(attemptId, message);
    return "gagal";
  } finally {
    await finishProcessing(attemptId);
  }
}

/**
 * Dipanggil cron (app/api/cron/proses-antrean-ai) tiap menit. Kandidatnya
 * dua jenis: (1) attempt yang benar-benar menunggu di antrean
 * (aiAnalysisQueuedAt terisi, belum diproses), dan (2) attempt yang macet
 * dari invocation cron sebelumnya (aiAnalysisProcessingAt lebih tua dari
 * STALE_MS - mis. function sebelumnya kena kill di tengah jalan karena
 * maxDuration) - diambil alih di sini, bukan menunggu dipicu ulang manual.
 *
 * Setiap kandidat diklaim SATU-SATU lewat tryStartProcessing (atomik) sebelum
 * diproses - aman kalau dua invocation cron berdekatan sama-sama mengambil
 * kandidat yang sama dari query di bawah (query ini cuma SELECT, bukan
 * SELECT...FOR UPDATE, jadi klaim atomik di tryStartProcessing yang jadi
 * satu-satunya sumber kebenaran soal "siapa yang berhak proses").
 */
export async function processAiQueue(): Promise<HasilProsesAntrean> {
  const staleThreshold = new Date(Date.now() - STALE_MS);
  const candidates = await prisma.attempt.findMany({
    where: {
      aiAnalysis: null,
      OR: [
        { aiAnalysisQueuedAt: { not: null }, aiAnalysisProcessingAt: null },
        { aiAnalysisProcessingAt: { lt: staleThreshold } },
      ],
    },
    orderBy: { aiAnalysisQueuedAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true },
  });

  const hasil: HasilProsesAntrean = { diklaim: 0, selesai: 0, gagal: 0, dilewati: 0 };
  const claimed: string[] = [];
  for (const c of candidates) {
    if (await tryStartProcessing(c.id)) claimed.push(c.id);
  }
  hasil.diklaim = claimed.length;

  await runWithRateLimit(
    claimed.map((id) => () => processOne(id)),
    {
      intervalMs: DISPATCH_INTERVAL_MS,
      maxConcurrent: MAX_CONCURRENT,
      onSettled: (status) => {
        if (status === "selesai") hasil.selesai++;
        else if (status === "gagal") hasil.gagal++;
        else hasil.dilewati++;
      },
    },
  );

  return hasil;
}
