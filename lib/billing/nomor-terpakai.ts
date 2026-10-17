import { prisma } from "@/lib/db/prisma";
import { formatNomorInvoice, urutBerikutnya, urutDariNomor, urutTerpakaiDiLuarAplikasi } from "@/lib/billing/nomor-invoice";

/**
 * Nomor invoice yang sudah dipakai untuk awalan bulan tertentu, dari SEMUA sumber: invoice sekolah dan invoice yang
 * diterbitkan lewat Pembuat Invoice (tabel invoice_bebas). Keduanya berbagi satu urutan per bulan, jadi tidak pernah ada dua
 * invoice dengan nomor yang sama. (Nomor yang dipakai di luar aplikasi ditambahkan oleh urutBerikutnya.)
 */
export async function ambilNomorTerpakai(awalan: string): Promise<string[]> {
  const [sekolah, bebas] = await Promise.all([
    prisma.schoolInvoice.findMany({ where: { nomorInvoice: { startsWith: awalan } }, select: { nomorInvoice: true } }),
    prisma.invoiceBebas.findMany({ where: { nomorInvoice: { startsWith: awalan } }, select: { nomorInvoice: true } }),
  ]);
  return [...sekolah.map((i) => i.nomorInvoice), ...bebas.map((i) => i.nomorInvoice)];
}

/** Nomor lengkap berikutnya untuk awalan itu (terbesar yang terpakai + 1). */
export async function nomorBerikutnyaUntukAwalan(awalan: string): Promise<{ urut: number; nomor: string }> {
  const urut = urutBerikutnya(await ambilNomorTerpakai(awalan), awalan);
  return { urut, nomor: formatNomorInvoice(awalan, urut) };
}

export type PemakaiNomor = "invoice_sekolah" | "invoice_bebas" | "luar_aplikasi";

/**
 * Siapa yang sudah memakai nomor ini; null bila masih bebas. "luar_aplikasi" = nomor yang pemilik terbitkan manual
 * sebelum aplikasi menerbitkan nomor sendiri (lihat nomor-invoice.ts).
 */
export async function pemakaiNomor(nomor: string, awalan: string): Promise<PemakaiNomor | null> {
  const [sekolah, bebas] = await Promise.all([
    prisma.schoolInvoice.findUnique({ where: { nomorInvoice: nomor }, select: { id: true } }),
    prisma.invoiceBebas.findUnique({ where: { nomorInvoice: nomor }, select: { id: true } }),
  ]);
  if (sekolah) return "invoice_sekolah";
  if (bebas) return "invoice_bebas";
  const urut = urutDariNomor(nomor, awalan);
  if (urut !== null && urut <= urutTerpakaiDiLuarAplikasi(awalan)) return "luar_aplikasi";
  return null;
}
