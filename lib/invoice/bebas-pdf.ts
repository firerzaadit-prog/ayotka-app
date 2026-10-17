import "server-only";
import { buatPdfInvoice } from "@/lib/pdf/invoice-sekolah-renderer";
import { namaBerkasInvoice } from "@/lib/pdf/invoice-identitas";
import { nomorInvoiceBebas, susunSpesifikasiBebas, type InvoiceBebasInput } from "@/lib/invoice/bebas";

/** PDF invoice dari isian Pembuat Invoice yang sudah divalidasi, beserta nomor dan nama berkas unduhannya. */
export async function buatPdfInvoiceBebas(input: InvoiceBebasInput): Promise<{ pdf: Buffer; nomor: string; namaBerkas: string }> {
  const nomor = nomorInvoiceBebas(input);
  const pdf = await buatPdfInvoice(susunSpesifikasiBebas(input));
  return { pdf, nomor, namaBerkas: namaBerkasInvoice(nomor, input.penerima.nama) };
}

/**
 * Respons PDF: `inline` untuk pratinjau di halaman, `attachment` untuk unduhan. Nama berkas hanya ASCII aman (lihat
 * namaBerkasInvoice). `tambahan` = header lain (mis. X-Nomor-Invoice); nilainya harus ASCII.
 */
export function responsPdfInvoice(pdf: Buffer, namaBerkas: string, sebagai: "inline" | "attachment", tambahan: Record<string, string> = {}): Response {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${sebagai}; filename="${namaBerkas}"`,
      "Cache-Control": "no-store",
      ...tambahan,
    },
  });
}
