import "server-only";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Bagian 9 brief: "rate limit granular per endpoint (login, cek kode
 * sekolah, pencarian nama, submit jawaban)". Implementasi in-memory per
 * proses - cukup untuk deployment single-instance; kalau nanti multi-instance
 * (mis. beberapa container di belakang load balancer), pindahkan ke
 * penyimpanan bersama (Redis) supaya limitnya konsisten lintas instance.
 *
 * SENGAJA TIDAK dipindah ke database seperti lib/exam/session-guard.ts &
 * lib/ai/analysis-guard.ts (audit sesi ini): dipanggil di jalur ter-panas
 * sistem (jawaban:${'{'}attemptId{'}'} dicek di SETIAP autosave PUT saat
 * siswa mengerjakan ujian), jadi menambah round-trip DB di sini berisiko
 * memperlambat pengerjaan ujian itu sendiri - trade-off yang beda dari dua
 * guard lain (yang jarang dipanggil: buka ujian & trigger analisis AI).
 * Dampak ketidaksinkronan lintas instance di sini juga cuma memperlonggar
 * limit (bukan menjebol autentikasi/otorisasi yang tetap dicek penuh di
 * tiap endpoint) - REDIS_URL sudah disiapkan di .env sebagai tempat naik
 * kelas resmi begitu ada kebutuhan/infra Redis yang nyata.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
