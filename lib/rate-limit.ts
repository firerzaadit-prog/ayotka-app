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
/** Jumlah ember yang boleh menumpuk sebelum yang sudah kedaluwarsa disapu (mencegah memori membengkak). */
const AMBANG_SAPU = 5_000;

/** Hapus ember yang jendelanya sudah lewat. Hanya berjalan kalau peta sudah besar, jadi biayanya jarang terasa. */
function sapuKedaluwarsa(now: number): void {
  if (buckets.size < AMBANG_SAPU) return;
  for (const [kunci, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(kunci);
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    sapuKedaluwarsa(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/**
 * Cek TANPA menambah hitungan: true kalau `key` sudah mencapai `limit` di jendela yang sedang
 * berjalan. Dipasangkan dengan recordRateLimitHit untuk membatasi kejadian tertentu saja
 * (mis. hanya login yang GAGAL, bukan semua percobaan) - checkRateLimit selalu menghitung
 * setiap pemanggilan.
 */
export function isRateLimited(key: string, limit: number): boolean {
  const bucket = buckets.get(key);
  return bucket != null && Date.now() <= bucket.resetAt && bucket.count >= limit;
}

/** Catat satu kejadian untuk `key` (membuka jendela baru kalau belum ada / sudah lewat). */
export function recordRateLimitHit(key: string, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    sapuKedaluwarsa(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
}
