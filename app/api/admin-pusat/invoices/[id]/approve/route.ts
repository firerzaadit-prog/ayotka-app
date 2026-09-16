import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const approveSchema = z.object({
  catatan: z.string().trim().min(1, "Catatan verifikasi wajib diisi").max(1000),
});

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Jaring pengaman Jalur A: webhook Midtrans SEHARUSNYA yang membuat
 * entitlement (lihat app/api/webhooks/midtrans), tapi kadang gagal sampai
 * (gateway bermasalah, siswa transfer manual lalu minta tolong admin, dst).
 * Endpoint ini SELALU wajib catatan verifikasi - ini jalur pengecualian,
 * bukan alur normal, jadi harus ada jejak kenapa admin melakukannya manual.
 */
export async function POST(request: Request, { params }: RouteParams) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: invoiceId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { plan: true } });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }
  if (invoice.status !== "pending" && invoice.status !== "expired") {
    return NextResponse.json(
      { error: "Hanya invoice berstatus pending atau expired yang bisa disetujui manual." },
      { status: 409 },
    );
  }

  const startsAt = new Date();
  const endsAt = invoice.plan.durasiHari ? addDays(startsAt, invoice.plan.durasiHari) : addDays(startsAt, 30);

  const [updatedInvoice] = await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "paid", paymentChannel: "manual" },
    }),
    prisma.entitlement.create({
      data: {
        studentId: invoice.studentId,
        planId: invoice.planId,
        startsAt,
        endsAt,
        source: "invoice",
        invoiceId: invoice.id,
      },
    }),
  ]);

  await logAudit({
    userId: actor.id,
    aksi: "update",
    entitas: "invoices",
    entitasId: invoice.id,
    before: { status: invoice.status },
    after: { status: "paid", paymentChannel: "manual", catatan: parsed.data.catatan },
    ip: getClientIp(request),
  });

  return NextResponse.json({ invoice: updatedInvoice });
}
