import "server-only";
import { prisma } from "@/lib/db/prisma";

/**
 * Tiket 5.3: status "sedang diproses" + pesan gagal terakhir untuk 1
 * attempt, disimpan di kolom Attempt.aiAnalysisProcessingAt/aiAnalysisLastError
 * (BUKAN lagi Set/Map in-memory) - pola guard yang sama dengan
 * lib/exam/session-guard.ts, alasan sama: deployment sesungguhnya (Vercel
 * serverless) bisa multi-instance, jadi status ini harus dibagi lewat
 * database, bukan memori per-proses. Sengaja tidak pakai BullMQ+Redis
 * (keputusan user): admin yang memicu analisis lewat tombol, bukan job
 * otomatis massal setiap attempt selesai, jadi antrean terpisah bukan
 * kebutuhan mendesak - yang penting klik tombolnya tidak bikin browser
 * admin menggantung nunggu AI (bisa retry sampai puluhan detik) dan tidak
 * ada 2 proses dobel untuk attempt yang sama.
 *
 * aiAnalysisLastError dibiarkan terpisah dari ai_analyses (tabel itu
 * sengaja cuma diisi kalau berhasil, lihat lib/ai/analyze.ts) - supaya
 * kalau gagal, admin tetap lihat PESAN kegagalannya alih-alih status diam-
 * diam balik ke "belum dianalisis" tanpa penjelasan.
 *
 * tryStartProcessing pakai SATU UPDATE...WHERE atomik (bukan baca-lalu-
 * tulis terpisah) supaya aman dari race dua klik/trigger bersamaan - juga
 * dipakai lib/ai/queue-worker.ts untuk mengklaim item antrean satu-satu,
 * aman dari dua invocation cron yang tumpang tindih (lihat file itu).
 * isProcessing sengaja fungsi murni (bukan query DB terpisah) - pemanggil
 * di app/api/attempts/[id]/analisis-ai/route.ts sudah men-fetch attempt-nya
 * sendiri, jadi field aiAnalysisProcessingAt tinggal dibaca dari situ.
 *
 * STALE_MS diekspor supaya lib/ai/queue-worker.ts pakai ambang yang PERSIS
 * sama saat memilih kandidat "macet dari run sebelumnya" - dua tempat baca
 * definisi stale yang berbeda akan bikin perilaku pengambilan-alih tidak
 * konsisten.
 */
export const STALE_MS = 5 * 60_000;

export async function tryStartProcessing(attemptId: string): Promise<boolean> {
  const staleThreshold = new Date(Date.now() - STALE_MS);
  const result = await prisma.attempt.updateMany({
    where: {
      id: attemptId,
      OR: [{ aiAnalysisProcessingAt: null }, { aiAnalysisProcessingAt: { lt: staleThreshold } }],
    },
    // aiAnalysisQueuedAt dikosongkan bersamaan - begitu diklaim untuk diproses,
    // item ini tidak lagi dianggap "masih menunggu di antrean" (lihat status
    // GET /api/attempts/[id]/analisis-ai dan hitungan antrean admin).
    data: { aiAnalysisProcessingAt: new Date(), aiAnalysisQueuedAt: null, aiAnalysisLastError: null },
  });
  return result.count > 0;
}

export async function finishProcessing(attemptId: string): Promise<void> {
  await prisma.attempt.updateMany({
    where: { id: attemptId },
    data: { aiAnalysisProcessingAt: null, aiAnalysisQueuedAt: null },
  });
}

export async function setLastError(attemptId: string, message: string): Promise<void> {
  await prisma.attempt.updateMany({
    where: { id: attemptId },
    data: { aiAnalysisLastError: message },
  });
}

export function isProcessing(aiAnalysisProcessingAt: Date | null): boolean {
  if (!aiAnalysisProcessingAt) return false;
  return Date.now() - aiAnalysisProcessingAt.getTime() < STALE_MS;
}
