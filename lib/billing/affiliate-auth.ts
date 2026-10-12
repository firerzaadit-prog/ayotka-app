import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { DAFTAR_KODE_PRODUK, type KodeProdukAffiliate } from "@/lib/billing/affiliate-produk";

/**
 * Pengaman panggilan dari affiliate.id (webhook Purchase dan endpoint SaaS check-email / check-account / success).
 * Sebelumnya alamat-alamat itu terbuka untuk siapa saja: cukup memanggil
 *   /api/webhooks/affiliate?email=<email siswa>&product_id=<id produk di tautan publik>&order_id=<karangan>
 * untuk mengisi saldo atau mengaktifkan langganan secara gratis, dan check-email membocorkan apakah sebuah email
 * terdaftar beserta ID akunnya.
 *
 * Kini setiap panggilan wajib membawa rahasia yang sama dengan milik server. affiliate.id tidak (diketahui) menyediakan
 * tanda tangan, jadi rahasia dipasang di alamat yang diisikan admin ke affiliate.id (`...?token=<rahasia>`); alamat
 * lengkapnya ditampilkan di Admin Pusat > Verifikasi Pembayaran. Diterima juga lewat header `Authorization: Bearer ...`
 * atau `X-Webhook-Token` bila suatu hari affiliate.id mengirimnya.
 *
 * Rahasia = AFFILIATE_WEBHOOK_SECRET bila diisi (minimal 16 karakter); bila tidak, diturunkan (HMAC) dari kunci enkripsi
 * server dengan label khusus, sehingga tidak perlu mengubah .env server dan tidak membocorkan kunci aslinya. Tanpa
 * keduanya, SEMUA panggilan ditolak (503): lebih baik tidak ada pembayaran otomatis daripada terbuka untuk siapa saja.
 */
const LABEL_TURUNAN = "ayotka:affiliate-webhook:v1";
const MIN_PANJANG_EKSPLISIT = 16;

type Env = Record<string, string | undefined>;

export function rahasiaWebhookAffiliate(env: Env = process.env): string | null {
  const eksplisit = env.AFFILIATE_WEBHOOK_SECRET?.trim();
  if (eksplisit && eksplisit.length >= MIN_PANJANG_EKSPLISIT) return eksplisit;
  const dasar = env.APP_ENCRYPTION_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dasar) return null;
  return createHmac("sha256", dasar).update(LABEL_TURUNAN).digest("hex").slice(0, 48);
}

/** Bandingkan dua string tanpa bocoran waktu (di-hash dulu supaya panjangnya sama). */
function samaAman(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Semua kandidat token pada permintaan. Nilai di query dipotong pada karakter pemisah supaya tahan terhadap alamat yang
 * ditempeli parameter dengan cara salah, mis. "?token=abc?email=x" (affiliate.id menambahkan "?" ke alamat yang sudah
 * punya query).
 */
function kandidatToken(request: Request): string[] {
  const kandidat: string[] = [];
  const potong = (v: string) => v.split(/[?&#\s]/)[0] ?? "";
  try {
    const dariQuery = new URL(request.url).searchParams.get("token");
    if (dariQuery) kandidat.push(potong(dariQuery));
  } catch {
    // alamat tidak terbaca: abaikan, kandidat lain tetap dicoba
  }
  const mentah = /[?&]token=([^&?#\s]+)/.exec(request.url);
  if (mentah?.[1]) kandidat.push(mentah[1]);

  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (bearer?.[1]) kandidat.push(bearer[1].trim());
  const header = request.headers.get("x-webhook-token");
  if (header) kandidat.push(header.trim());
  return kandidat.filter(Boolean);
}

export type HasilAkses = { ok: true } | { ok: false; status: 401 | 503; pesan: string };

export function periksaAksesAffiliate(request: Request, env: Env = process.env): HasilAkses {
  const rahasia = rahasiaWebhookAffiliate(env);
  if (!rahasia) {
    return { ok: false, status: 503, pesan: "Pembayaran otomatis belum dikonfigurasi di server." };
  }
  const cocok = kandidatToken(request).some((token) => samaAman(token, rahasia));
  return cocok ? { ok: true } : { ok: false, status: 401, pesan: "Tidak diizinkan." };
}

/**
 * Alamat lengkap (dengan rahasia) yang diisikan admin ke pengaturan produk di affiliate.id. Purchase, Check Email dan
 * Check Account sama untuk semua produk. Success berbeda per produk (membawa `produk=<kode>`) karena panggilan Success
 * dari affiliate.id tidak menyebutkan produk yang dibeli; lihat lib/billing/affiliate-produk.ts.
 */
export function alamatWebhookAffiliate(asal: string, env: Env = process.env) {
  const rahasia = rahasiaWebhookAffiliate(env);
  if (!rahasia) return null;
  const dasar = asal.replace(/\/+$/, "");
  const dengan = (jalur: string, tambahan = "") => `${dasar}${jalur}?token=${rahasia}${tambahan}`;
  const success = Object.fromEntries(
    DAFTAR_KODE_PRODUK.map((kode) => [kode, dengan("/api/webhooks/affiliate/success", `&produk=${kode}`)]),
  ) as Record<KodeProdukAffiliate, string>;
  return {
    purchase: dengan("/api/webhooks/affiliate"),
    checkEmail: dengan("/api/webhooks/affiliate/check-email"),
    checkAccount: dengan("/api/webhooks/affiliate/check-account"),
    success,
  };
}
