/**
 * Produk affiliate.id yang dikenali AyoTKA, dan cara membacanya dari alamat panggilan.
 *
 * Panggilan Success SaaS dari affiliate.id TIDAK memberi tahu produk apa yang dibeli: isinya hanya
 *   { uid, type: "onetime", duration, affiliateId, invoice_number }
 * (terbukti dari audit log 11 Okt). Kode lama mengira produk dari nama parameter yang ternyata tidak ada, lalu
 * diam-diam menganggapnya top-up 50.000; setelah itu ditutup, panggilan Success selalu ditolak. Karena itu tiap produk
 * mendapat alamat Success sendiri yang membawa `produk=<kode>`; alamat itu rahasia (membawa token), jadi kodenya
 * bisa dipercaya.
 */
export type JenisProduk = "topup_50k" | "topup_25k" | "langganan_bulanan" | "langganan_semester";

export const KODE_PRODUK_AFFILIATE = {
  topup25k: { jenis: "topup_25k", label: "Top Up 25.000" },
  topup50k: { jenis: "topup_50k", label: "Top Up 50.000" },
  bulanan: { jenis: "langganan_bulanan", label: "Paket Bulanan" },
  semester: { jenis: "langganan_semester", label: "Paket Semester" },
} as const satisfies Record<string, { jenis: JenisProduk; label: string }>;

export type KodeProdukAffiliate = keyof typeof KODE_PRODUK_AFFILIATE;

export const DAFTAR_KODE_PRODUK = Object.keys(KODE_PRODUK_AFFILIATE) as KodeProdukAffiliate[];

/** Kode produk -> jenis; null untuk kode yang tidak dikenal (termasuk kosong). */
export function jenisDariKode(kode: string | null | undefined): JenisProduk | null {
  const bersih = (kode ?? "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(KODE_PRODUK_AFFILIATE, bersih)
    ? KODE_PRODUK_AFFILIATE[bersih as KodeProdukAffiliate].jenis
    : null;
}

/**
 * Kode produk di alamat panggilan (`?produk=`). Dipotong pada karakter pemisah supaya tahan terhadap alamat yang
 * ditempeli parameter dengan cara salah, mis. "?produk=topup25k?uid=x" (affiliate.id bisa menambahkan "?" ke alamat
 * yang sudah punya query). Hanya dibaca dari alamat, tidak dari isi panggilan, supaya tidak bisa ditimpa data kiriman.
 */
export function kodeProdukDariAlamat(request: Request): string | null {
  const potong = (v: string) => v.split(/[?&#\s]/)[0] ?? "";
  let nilai: string | null = null;
  try {
    nilai = new URL(request.url).searchParams.get("produk");
  } catch {
    nilai = null;
  }
  if (!nilai) {
    const mentah = /[?&]produk=([^&?#\s]+)/.exec(request.url);
    nilai = mentah?.[1] ?? null;
  }
  const kode = nilai ? potong(nilai).trim() : "";
  return kode || null;
}
