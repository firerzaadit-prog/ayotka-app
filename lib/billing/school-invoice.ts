import { formatInTimeZone } from "date-fns-tz";
import { awalanNomorInvoice } from "@/lib/billing/nomor-invoice";
import { nomorBerikutnyaUntukAwalan } from "@/lib/billing/nomor-terpakai";

/**
 * Nomor invoice unik berikutnya untuk bulan ini (WIB): INV/AYOTKA/{tahun}/{bulan romawi}/{urut 3 digit}, mis.
 * INV/AYOTKA/2026/X/002 (aturan format di lib/billing/nomor-invoice.ts). Urutannya dibagi dengan invoice yang diterbitkan
 * lewat Pembuat Invoice Admin Pusat (lib/billing/nomor-terpakai.ts). Dua pembuat invoice yang bersamaan bisa mendapat nomor
 * yang sama; kolom nomorInvoice unik, jadi penyimpan (rute pembuatan invoice) mengulang dari sini bila terjadi benturan.
 */
export async function generateNomorInvoiceSekolah(now: Date = new Date()): Promise<string> {
  const tahun = Number(formatInTimeZone(now, "Asia/Jakarta", "yyyy"));
  const bulan = Number(formatInTimeZone(now, "Asia/Jakarta", "M"));
  return (await nomorBerikutnyaUntukAwalan(awalanNomorInvoice(tahun, bulan))).nomor;
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
