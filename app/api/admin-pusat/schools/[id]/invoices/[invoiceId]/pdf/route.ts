import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { buatPdfInvoiceSekolah } from "@/lib/pdf/invoice-sekolah-renderer";
import { namaBerkasInvoice } from "@/lib/pdf/invoice-identitas";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; invoiceId: string }> },
) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId, invoiceId } = await context.params;

  const invoice = await prisma.schoolInvoice.findFirst({
    where: { id: invoiceId, schoolId },
    include: {
      school: true,
      periode: true,
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }

  const bankAccount = await prisma.bankAccount.findFirst({
    where: { isActive: true },
    orderBy: { namaBank: "asc" },
  });

  const pdf = await buatPdfInvoiceSekolah({
    invoice,
    school: invoice.school,
    periode: invoice.periode,
    bankAccount,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${namaBerkasInvoice(invoice.nomorInvoice, invoice.school.nama)}"`,
      "Cache-Control": "no-store",
    },
  });
}
