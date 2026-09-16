/**
 * Diskon grosir Jalur C lewat Midtrans (permintaan user): makin banyak
 * voucher yang dibeli sekaligus, makin besar diskonnya - dicek dari yang
 * paling tinggi dulu supaya jumlah 50+ tidak salah kena tingkatan 10-49.
 * Ubah di sini saja kalau nanti mau ganti angka tingkatannya. Sengaja TANPA
 * "server-only" - fungsi ini murni matematika, dipakai server (checkout
 * route) maupun client (pratinjau harga di halaman Beli Voucher).
 */
export const VOUCHER_PRICE_TIERS = [
  { minJumlah: 50, diskonPersen: 20, label: "50+ voucher" },
  { minJumlah: 10, diskonPersen: 10, label: "10-49 voucher" },
  { minJumlah: 1, diskonPersen: 0, label: "1-9 voucher" },
] as const;

export function getVoucherDiscountPercent(jumlah: number): number {
  for (const tier of VOUCHER_PRICE_TIERS) {
    if (jumlah >= tier.minJumlah) return tier.diskonPersen;
  }
  return 0;
}

export function computeVoucherOrderAmount(
  hargaSatuan: number,
  jumlah: number,
): { amount: number; diskonPersen: number } {
  const diskonPersen = getVoucherDiscountPercent(jumlah);
  const amount = Math.round((hargaSatuan * jumlah * (100 - diskonPersen)) / 100);
  return { amount, diskonPersen };
}
