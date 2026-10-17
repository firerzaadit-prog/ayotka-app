import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { buatPdfInvoiceSekolah } from "@/lib/pdf/invoice-sekolah-renderer";
import { namaBerkasInvoice } from "@/lib/pdf/invoice-identitas";

export async function GET(
  request: Request,
  context: { params: Promise<{ invoiceId: string }> },
) {
  let user;
  try {
    user = await requireRole("admin_sekolah", "admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const { invoiceId } = await context.params;

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
