import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { renderInvoiceSekolahPdf } from "@/lib/pdf/invoice-sekolah-renderer";

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

  const logo = await readFile(path.join(process.cwd(), "public", "logo.png")).catch(() => null);

  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const finishPromise = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(chunks))),
  );

  await renderInvoiceSekolahPdf(
    doc,
    {
      invoice,
      school: invoice.school,
      periode: invoice.periode,
      bankAccount,
    },
    logo,
  );
  doc.end();

  const pdf = await finishPromise;
  const safeNumber = invoice.nomorInvoice.replace(/[^a-zA-Z0-9_-]/g, "-");
  const filename = `invoice-${safeNumber}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
