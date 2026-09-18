/**
 * Diskon grosir mitra beli voucher (Bagian A, permintaan user) - dulu
 * hardcoded di sini, sekarang tingkatannya disimpan di tabel
 * voucher_price_tiers dan bisa diatur admin pusat kapan saja tanpa deploy
 * ulang (lihat lib/billing/voucher-price-tiers.ts untuk loader-nya).
 * Fungsi di sini tetap murni matematika (terima tiers sebagai parameter,
 * bukan mengambilnya sendiri) - sengaja TANPA "server-only" supaya tetap
 * bisa dipakai untuk pratinjau harga di client (tiers dikirim dari API,
 * bukan diimpor langsung dari DB).
 */
export type VoucherPriceTier = { minJumlah: number; diskonPersen: number; label: string };

/** Dicek dari minJumlah PALING TINGGI dulu supaya jumlah besar tidak salah kena tingkatan lebih rendah. */
export function getVoucherDiscountPercent(tiers: VoucherPriceTier[], jumlah: number): number {
  const sorted = [...tiers].sort((a, b) => b.minJumlah - a.minJumlah);
  for (const tier of sorted) {
    if (jumlah >= tier.minJumlah) return tier.diskonPersen;
  }
  return 0;
}

export function computeVoucherOrderAmount(
  tiers: VoucherPriceTier[],
  hargaSatuan: number,
  jumlah: number,
): { amount: number; diskonPersen: number } {
  const diskonPersen = getVoucherDiscountPercent(tiers, jumlah);
  const amount = Math.round((hargaSatuan * jumlah * (100 - diskonPersen)) / 100);
  return { amount, diskonPersen };
}
