import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyMidtransSignature } from "@/lib/billing/midtrans";
import { generateUniqueVoucherCodes } from "@/lib/billing/vouchers";
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
 * Satu-satunya endpoint yang menerima webhook payment gateway, dipakai TIGA
 * jalur: Jalur A (Invoice siswa individu, Bagian 4 dokumen rencana), Jalur C
 * lewat Midtrans (VoucherOrder mitra, permintaan user), dan top-up saldo
 * wallet (SaldoTransaction, Bagian D/G permintaan user). Order id Midtrans =
 * id baris kita sendiri, jadi order_id yang sama tidak mungkin cocok di dua
 * tabel sekaligus - dicoba invoices dulu, lalu voucher_orders, lalu
 * saldo_transactions. Signature WAJIB diverifikasi sebelum payload
 * dipercaya (mencegah webhook dipalsukan pihak luar).
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
    return NextResponse.json({ error: "Sistem pembayaran belum dikonfigurasi." }, { status: 503 });
  }
  if (!signatureValid) {
    return NextResponse.json({ error: "Signature tidak valid." }, { status: 401 });
  }

  const isPaid = n.transaction_status === "capture" || n.transaction_status === "settlement";
  const isFailed = ["deny", "cancel", "expire"].includes(n.transaction_status);

  const invoice = await prisma.invoice.findUnique({ where: { id: n.order_id }, include: { plan: true } });
  if (invoice) {
    // Sudah diproses sebelumnya (webhook Midtrans bisa terkirim >1 kali) -
    // jangan buat entitlement dobel.
    if (invoice.status !== "pending") {
      return NextResponse.json({ ok: true });
    }

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

  const voucherOrder = await prisma.voucherOrder.findUnique({
    where: { id: n.order_id },
    include: { partner: { select: { userId: true } } },
  });
  if (voucherOrder) {
    if (voucherOrder.status !== "pending") {
      return NextResponse.json({ ok: true });
    }

    if (isPaid) {
      // Kode-kode dibuat DULU (baca saja, belum ditulis) baru ditulis
      // bersamaan dengan update status dalam satu transaksi - supaya kalau
      // webhook ini terkirim ulang sebelum baris pertama sempat commit,
      // pengecekan status "pending" di atas tetap konsisten dan tidak
      // pernah menggandakan voucher.
      const codes = await generateUniqueVoucherCodes(voucherOrder.jumlah);
      await prisma.$transaction([
        prisma.voucherOrder.update({
          where: { id: voucherOrder.id },
          data: {
            status: "paid",
            gatewayRef: n.transaction_id ?? null,
            paymentChannel: n.payment_type ?? null,
          },
        }),
        ...codes.map((code) =>
          prisma.voucher.create({
            data: {
              code,
              planId: voucherOrder.planId,
              partnerId: voucherOrder.partnerId,
              generatedById: voucherOrder.partner.userId,
              voucherOrderId: voucherOrder.id,
            },
          }),
        ),
      ]);

      await logAudit({
        userId: null,
        aksi: "update",
        entitas: "voucher_orders",
        entitasId: voucherOrder.id,
        after: { status: "paid", jumlah: voucherOrder.jumlah },
      });
    } else if (isFailed) {
      await prisma.voucherOrder.update({ where: { id: voucherOrder.id }, data: { status: "expired" } });
    }

    return NextResponse.json({ ok: true });
  }

  const saldoTx = await prisma.saldoTransaction.findUnique({ where: { id: n.order_id } });
  if (saldoTx) {
    if (saldoTx.status !== "pending") {
      return NextResponse.json({ ok: true });
    }

    if (isPaid) {
      await prisma.saldoTransaction.update({
        where: { id: saldoTx.id },
        data: { status: "berhasil", gatewayRef: n.transaction_id ?? null, paymentChannel: n.payment_type ?? null },
      });

      await logAudit({
        userId: null,
        aksi: "update",
        entitas: "saldo_transactions",
        entitasId: saldoTx.id,
        after: { status: "berhasil", jumlah: saldoTx.jumlah },
      });
    } else if (isFailed) {
      await prisma.saldoTransaction.update({ where: { id: saldoTx.id }, data: { status: "gagal" } });
    }

    return NextResponse.json({ ok: true });
  }

  // Order id tidak dikenal di ketiga tabel - balas 200 supaya Midtrans tidak
  // retry terus, tapi tidak melakukan apa pun (kemungkinan transaksi test).
  return NextResponse.json({ ok: true });
}
