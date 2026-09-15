import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyMidtransSignature } from "@/lib/billing/midtrans";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";

const notificationSchema = z.object({
  order_id: z.string(),
  status_code: z.string(),
  gross_amount: z.string(),
  signature_key: z.string(),
  transaction_status: z.string(),
  transaction_id: z.string().optional(),
  payment_type: z.string().optional(),
});

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Jalur A SAJA - satu-satunya endpoint yang menerima webhook payment
 * gateway (Bagian 4 dokumen rencana). Signature WAJIB diverifikasi
 * sebelum payload dipercaya (mencegah webhook dipalsukan pihak luar).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = notificationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }
  const n = parsed.data;

  let signatureValid: boolean;
  try {
    signatureValid = verifyMidtransSignature({
      orderId: n.order_id,
      statusCode: n.status_code,
      grossAmount: n.gross_amount,
      signatureKey: n.signature_key,
    });
  } catch {
    return NextResponse.json({ error: "Midtrans belum dikonfigurasi." }, { status: 503 });
  }
  if (!signatureValid) {
    return NextResponse.json({ error: "Signature tidak valid." }, { status: 401 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: n.order_id }, include: { plan: true } });
  if (!invoice) {
    // Order id tidak dikenal - balas 200 supaya Midtrans tidak retry terus,
    // tapi tidak melakukan apa pun (kemungkinan invoice test dari sandbox).
    return NextResponse.json({ ok: true });
  }

  // Sudah diproses sebelumnya (webhook Midtrans bisa terkirim >1 kali) -
  // jangan buat entitlement dobel.
  if (invoice.status !== "pending") {
    return NextResponse.json({ ok: true });
  }

  const isPaid = n.transaction_status === "capture" || n.transaction_status === "settlement";
  const isFailed = ["deny", "cancel", "expire"].includes(n.transaction_status);

  if (isPaid) {
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "paid",
          gatewayRef: n.transaction_id ?? null,
          paymentChannel: n.payment_type ?? null,
        },
      });

      const startsAt = new Date();
      const endsAt = invoice.plan.durasiHari ? addDays(startsAt, invoice.plan.durasiHari) : addDays(startsAt, 30);
      await tx.entitlement.create({
        data: {
          studentId: invoice.studentId,
          planId: invoice.planId,
          startsAt,
          endsAt,
          source: "invoice",
          invoiceId: invoice.id,
        },
      });
    });

    await logAudit({
      userId: null,
      aksi: "update",
      entitas: "invoices",
      entitasId: invoice.id,
      after: { status: "paid" },
    });
  } else if (isFailed) {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "expired" } });
  }

  return NextResponse.json({ ok: true });
}
