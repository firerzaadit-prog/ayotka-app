import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { invoiceBebasSchema, pesanGalatInvoiceBebas } from "@/lib/invoice/bebas";
import { buatPdfInvoiceBebas, responsPdfInvoice } from "@/lib/invoice/bebas-pdf";

/**
 * Pratinjau PDF untuk halaman Pembuat Invoice: dirender dari isian formulir tanpa menyimpan apa pun dan tanpa memakai
 * nomor (nomor baru tercatat saat invoice diterbitkan, di ../route.ts). Isian yang belum lengkap menghasilkan 400 dengan
 * pesan yang ditampilkan di tempat pratinjau.
 */
export async function POST(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = invoiceBebasSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: pesanGalatInvoiceBebas(parsed.error) }, { status: 400 });
  }

  const { pdf, namaBerkas } = await buatPdfInvoiceBebas(parsed.data);
  return responsPdfInvoice(pdf, namaBerkas, "inline");
}
