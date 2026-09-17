import "server-only";
import { prisma } from "@/lib/db/prisma";

export const DEFAULT_VOUCHER_PRICE_TIERS = [
  { id: "default-1", minJumlah: 2, diskonPersen: 20, label: "2 - 9 Siswa" },
  { id: "default-2", minJumlah: 10, diskonPersen: 25, label: "10 - 49 Siswa" },
  { id: "default-3", minJumlah: 50, diskonPersen: 30, label: "50+ Siswa" },
];

/** Diurutkan naik untuk tampilan admin - getVoucherDiscountPercent mengurutkan ulang sendiri turun saat menghitung. */
export async function getVoucherPriceTiers() {
  const tiers = await prisma.voucherPriceTier.findMany({ orderBy: { minJumlah: "asc" } });
  if (tiers.length === 0) {
    return DEFAULT_VOUCHER_PRICE_TIERS;
  }
  return tiers;
}

