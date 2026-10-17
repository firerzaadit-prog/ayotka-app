import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { invoiceBebasSchema } from "@/lib/invoice/bebas";
import { buatPdfInvoiceBebas, responsPdfInvoice } from "@/lib/invoice/bebas-pdf";

/** Unduh ulang PDF invoice yang pernah diterbitkan, dirender dari isian yang tersimpan (nomor dan isinya sama persis). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }
  const baris = await prisma.invoiceBebas.findUnique({ where: { id }, select: { data: true } });
  if (!baris) return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });

  const parsed = invoiceBebasSchema.safeParse(baris.data);
  if (!parsed.success) {
    console.error(`[invoice-bebas] isian tersimpan invoice ${id} tidak lolos validasi:`, parsed.error.issues[0]);
    return NextResponse.json({ error: "Isian invoice tersimpan tidak bisa dibaca. Hubungi pengembang." }, { status: 500 });
  }

  const { pdf, namaBerkas } = await buatPdfInvoiceBebas(parsed.data);
  return responsPdfInvoice(pdf, namaBerkas, "attachment");
}
