import { buildWhatsAppLink } from "@/lib/utils/whatsapp";

/**
 * Pembayaran sementara lewat tautan affiliate.id (permintaan user, 30 Sep
 * 2026) - dipakai SELAMA Midtrans belum disetujui. affiliate.id tidak (diketahui)
 * mengirim notifikasi ke sistem ini, jadi aktivasinya MANUAL: siswa bayar di
 * affiliate.id, kirim bukti ke admin lewat WhatsApp, lalu admin pusat
 * mengaktifkan di Admin Pusat > Verifikasi Pembayaran > Aktivasi Manual
 * (app/api/admin-pusat/aktivasi-manual).
 *
 * Modul ini murni (tanpa server-only) supaya dipakai di server maupun komponen
 * client. Kembali ke Midtrans: set env PAYMENT_MODE=midtrans (lihat getPaymentMode)
 * - kode Midtrans (checkout, top-up, webhook) sengaja tidak dihapus.
 */

export type PaymentMode = "affiliate" | "midtrans";

/** Default "affiliate" selama Midtrans belum aktif. Server-side saja (env tanpa NEXT_PUBLIC_). */
export function getPaymentMode(): PaymentMode {
  return process.env.PAYMENT_MODE === "midtrans" ? "midtrans" : "affiliate";
}

const AFFILIATE_BASE = "https://www.affiliate.id/tomili2204-gmail--1789370238619066965/product";
const AFFILIATE_QS = "?aff=tomili2204-gmail--1789370238619066965";

function link(slug: string): string {
  return `${AFFILIATE_BASE}/${slug}${AFFILIATE_QS}`;
}

export const AFFILIATE_SLUG_PLAN = {
  monthly: "ayotkaid-bulanan-OngB8kshcTdiPiai49fx",
  semester: "ayotkaid-pembayaran-1-semester-T8rMqjdApjU940LkYgul",
} as const;

export const AFFILIATE_SLUG_TOPUP = {
  25_000: "ayotkid-pembayaran-topup-kredit-25000-KnvFM8Z81a42ut0ZkRHg",
  50_000: "ayotkaid-top-up-kredit-50000-jqKvm6YMT1YzqDwgdVey",
} as const;

export function buildAffiliateUrl(slug: string, options?: { email?: string; nama?: string }): string {
  let url = `${AFFILIATE_BASE}/${slug}${AFFILIATE_QS}`;
  if (options?.email) {
    url += `&email=${encodeURIComponent(options.email)}`;
  }
  if (options?.nama) {
    url += `&name=${encodeURIComponent(options.nama)}`;
  }
  return url;
}

/** Tautan produk per paket langganan (kunci = Plan.kode). */
export const AFFILIATE_LINK_PLAN: Record<string, string> = {
  monthly: link(AFFILIATE_SLUG_PLAN.monthly),
  semester: link(AFFILIATE_SLUG_PLAN.semester),
};

/**
 * Tautan produk top-up kredit per nominal. Baru dua nominal yang punya produk
 * di affiliate.id - nominal lain (100rb/200rb) disembunyikan di mode affiliate.
 */
export const AFFILIATE_LINK_TOPUP: Record<number, string> = {
  25_000: link(AFFILIATE_SLUG_TOPUP[25_000]),
  50_000: link(AFFILIATE_SLUG_TOPUP[50_000]),
};

function rupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/** Pesan WhatsApp siap kirim untuk konfirmasi pembayaran langganan. */
export function buildKonfirmasiLanggananWa(input: { namaPaket: string; harga: number; email: string }): string {
  return buildWhatsAppLink(
    `Halo Admin AyoTKA, saya sudah membayar paket ${input.namaPaket} (${rupiah(input.harga)}) lewat affiliate.id. ` +
      `Email akun saya: ${input.email}. Berikut bukti pembayarannya (saya lampirkan). Mohon langganan saya diaktifkan. Terima kasih.`,
  );
}

/** Pesan WhatsApp siap kirim untuk konfirmasi top-up kredit. */
export function buildKonfirmasiTopupWa(input: { nominal: number | null; email: string }): string {
  const jumlah = input.nominal != null ? ` ${rupiah(input.nominal)}` : "";
  return buildWhatsAppLink(
    `Halo Admin AyoTKA, saya sudah top up kredit${jumlah} lewat affiliate.id. ` +
      `Email akun saya: ${input.email}. Berikut bukti pembayarannya (saya lampirkan). Mohon saldo saya ditambahkan. Terima kasih.`,
  );
}
