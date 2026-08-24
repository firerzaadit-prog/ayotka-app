import "server-only";

/**
 * Tiket 5.3: status "sedang diproses" untuk 1 attempt, in-memory per proses
 * (pola yang sama seperti lib/exam/session-guard.ts) - cukup untuk 1
 * instance server, perlu Redis/store bersama kalau nanti deploy
 * multi-instance. Sengaja tidak pakai BullMQ+Redis (keputusan user): admin
 * yang memicu analisis lewat tombol, bukan job otomatis massal setiap
 * attempt selesai, jadi antrean terpisah bukan kebutuhan mendesak - yang
 * penting klik tombolnya tidak bikin browser admin menggantung nunggu AI
 * (bisa retry sampai puluhan detik) dan tidak ada 2 proses dobel untuk
 * attempt yang sama.
 */
const processing = new Set<string>();

export function isProcessing(attemptId: string): boolean {
  return processing.has(attemptId);
}

export function tryStartProcessing(attemptId: string): boolean {
  if (processing.has(attemptId)) return false;
  processing.add(attemptId);
  return true;
}

export function finishProcessing(attemptId: string): void {
  processing.delete(attemptId);
}
