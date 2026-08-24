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
 *
 * lastError disimpan terpisah dari ai_analyses (tabel itu sengaja cuma
 * diisi kalau berhasil, lihat lib/ai/analyze.ts) - supaya kalau gagal,
 * admin tetap lihat PESAN kegagalannya alih-alih status diam-diam balik
 * ke "belum dianalisis" tanpa penjelasan.
 */
const processing = new Set<string>();
const lastError = new Map<string, string>();

export function isProcessing(attemptId: string): boolean {
  return processing.has(attemptId);
}

export function tryStartProcessing(attemptId: string): boolean {
  if (processing.has(attemptId)) return false;
  processing.add(attemptId);
  lastError.delete(attemptId);
  return true;
}

export function finishProcessing(attemptId: string): void {
  processing.delete(attemptId);
}

export function setLastError(attemptId: string, message: string): void {
  lastError.set(attemptId, message);
}

export function getLastError(attemptId: string): string | undefined {
  return lastError.get(attemptId);
}
