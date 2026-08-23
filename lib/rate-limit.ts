import "server-only";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Bagian 9 brief: "rate limit granular per endpoint (login, cek kode
 * sekolah, pencarian nama, submit jawaban)". Implementasi in-memory per
 * proses - cukup untuk deployment single-instance; kalau nanti multi-instance
 * (mis. beberapa container di belakang load balancer), pindahkan ke
 * penyimpanan bersama (Redis) supaya limitnya konsisten lintas instance.
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
