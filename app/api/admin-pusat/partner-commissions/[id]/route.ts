import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { partnerCommissionUpdateSchema } from "@/lib/validations/partner";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Admin menetapkan nominal komisi (hasil negosiasi manual per sekolah,
 * tidak bisa dihitung otomatis - lihat komentar model PartnerCommission)
 * dan menandai lunas setelah ditransfer di luar sistem.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.partnerCommission.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Komisi tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = partnerCommissionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }
  const { amount, status, note } = parsed.data;

  const commission = await prisma.partnerCommission.update({
    where: { id },
    data: {
      ...(amount !== undefined ? { amount } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(status !== undefined
        ? { status, paidAt: status === "paid" ? new Date() : null }
        : {}),
    },
  });

  await logAudit({
    userId: actor.id,
    aksi: "update",
    entitas: "partner_commissions",
    entitasId: id,
    before,
    after: commission,
    ip: getClientIp(request),
  });

  return NextResponse.json({ commission });
}
