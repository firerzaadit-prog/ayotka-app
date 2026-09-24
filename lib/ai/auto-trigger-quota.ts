/**
 * Logika murni jatah analisis AI OTOMATIS per siswa per mata pelajaran -
 * dipisah dari lib/ai/auto-trigger.ts (yang "server-only" karena akses
 * Prisma) supaya bisa diuji langsung tanpa mock DB, konsisten dengan pola
 * lib/exam/scoring.ts (logika murni terpisah dari orkestrasi DB).
 */
export function hasReachedAutoAnalysisQuota(usedCount: number, max: number): boolean {
  return usedCount >= max;
}

export type ModeAnalisisAi = "langsung" | "antrean";

/**
 * Nilai apa pun selain persis "antrean" (kosong, salah ketik, data lama)
 * dianggap "langsung" - mode yang aman: Analisis AI tetap diproses seperti
 * biasa, tidak pernah menggantung menunggu cron yang mungkin belum jalan.
 */
export function normalisasiModeAnalisis(nilai: unknown): ModeAnalisisAi {
  return nilai === "antrean" ? "antrean" : "langsung";
}
