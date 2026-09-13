/**
 * Logika murni jatah analisis AI OTOMATIS per siswa per mata pelajaran -
 * dipisah dari lib/ai/auto-trigger.ts (yang "server-only" karena akses
 * Prisma) supaya bisa diuji langsung tanpa mock DB, konsisten dengan pola
 * lib/exam/scoring.ts (logika murni terpisah dari orkestrasi DB).
 */
export function hasReachedAutoAnalysisQuota(usedCount: number, max: number): boolean {
  return usedCount >= max;
}
