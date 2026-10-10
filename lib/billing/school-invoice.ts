import { prisma } from "@/lib/db/prisma";
import { formatInTimeZone } from "date-fns-tz";

/**
 * Generate nomor invoice unik dengan format INV/TKA/YYYYMM/XXXX
 * Contoh: INV/TKA/202610/0001
 */
export async function generateNomorInvoiceSekolah(): Promise<string> {
  const now = new Date();
  const yearMonth = formatInTimeZone(now, "Asia/Jakarta", "yyyyMM");
  const prefix = `INV/TKA/${yearMonth}`;

  const lastInvoice = await prisma.schoolInvoice.findFirst({
    where: { nomorInvoice: { startsWith: prefix } },
    orderBy: { nomorInvoice: "desc" },
    select: { nomorInvoice: true },
  });

  let nextSeq = 1;
  if (lastInvoice?.nomorInvoice) {
    const parts = lastInvoice.nomorInvoice.split("/");
    const lastSeq = parseInt(parts[parts.length - 1] ?? "0", 10);
    if (!Number.isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  const seqPadded = String(nextSeq).padStart(4, "0");
  return `${prefix}/${seqPadded}`;
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
