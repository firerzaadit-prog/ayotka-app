import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const refundSchema = z.object({ force: z.boolean().optional() });

/**
 * Jalur A saja (Bagian 9 dokumen rencana - kasus tepi refund): sebelum
 * membatalkan invoice yang sudah dibayar, cek dulu apakah siswa sudah
 * memakai akses yang dibeli (ada attempt sejak entitlement ini aktif).
 * Kalau sudah dipakai, admin wajib konfirmasi ulang (force) - supaya
 * refund tidak dilakukan tanpa sadar setelah try out-nya sudah dipakai.
 */
export async function POST(request: Request, { params }: RouteParams) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: invoiceId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = refundSchema.safeParse(body ?? {});
  const force = parsed.success ? Boolean(parsed.data.force) : false;

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }
  if (invoice.status !== "paid") {
    return NextResponse.json(
      { error: "Hanya invoice berstatus sudah dibayar yang bisa direfund." },
      { status: 409 },
    );
  }

  const entitlement = await prisma.entitlement.findFirst({
    where: { invoiceId: invoice.id, revokedAt: null },
  });

  const attemptCount = entitlement
    ? await prisma.attempt.count({
        where: { studentId: invoice.studentId, mulaiAt: { gte: entitlement.startsAt } },
      })
    : 0;

  if (attemptCount > 0 && !force) {
    return NextResponse.json(
      {
        requiresConfirmation: true,
        attemptCount,
        message: `Siswa ini sudah mengerjakan ${attemptCount} try out sejak akses ini aktif. Refund tetap membatalkan akses (tanpa membatalkan try out yang sudah dikerjakan) - lanjutkan?`,
      },
      { status: 200 },
    );
  }

  const [updatedInvoice] = await prisma.$transaction([
    prisma.invoice.update({ where: { id: invoice.id }, data: { status: "refunded" } }),
    ...(entitlement
      ? [prisma.entitlement.update({ where: { id: entitlement.id }, data: { revokedAt: new Date() } })]
      : []),
  ]);

  await logAudit({
    userId: actor.id,
    aksi: "update",
    entitas: "invoices",
    entitasId: invoice.id,
    before: { status: invoice.status },
    after: { status: "refunded", attemptCountAtRefund: attemptCount },
    ip: getClientIp(request),
  });

  return NextResponse.json({ invoice: updatedInvoice });
}
