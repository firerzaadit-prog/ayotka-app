import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { orderReviewSchema } from "@/lib/validations/order";
import { SUBJECT_TRYOUT_COUNT } from "@/lib/billing/subject-tryout";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Bagian 7.3 brief: ACC/tolak order try out mapel. ACC menambah
 * SubjectTryOutQuota.total sebanyak SUBJECT_TRYOUT_COUNT untuk SETIAP mapel
 * di order ini (kumulatif kalau mapel yang sama pernah dibeli sebelumnya -
 * upsert, bukan replace, supaya sisa try out lama tidak hilang).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  let admin;
  try {
    admin = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const order = await prisma.subjectTryOutOrder.findUnique({ where: { id }, include: { items: true } });
  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  }
  if (order.status !== "menunggu_verifikasi") {
    return NextResponse.json({ error: "Order ini sudah diproses sebelumnya." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = orderReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const now = new Date();
  const catatanAdmin = parsed.data.catatanAdmin || null;

  if (parsed.data.action === "tolak") {
    const updated = await prisma.subjectTryOutOrder.update({
      where: { id },
      data: { status: "ditolak", disetujuiOlehAdminId: admin.id, disetujuiAt: now, catatanAdmin },
    });

    await logAudit({
      userId: admin.id,
      aksi: "update",
      entitas: "subject_tryout_orders",
      entitasId: id,
      before: order,
      after: updated,
      ip: getClientIp(request),
    });

    return NextResponse.json({ order: updated });
  }

  const result = await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.subjectTryOutQuota.upsert({
        where: { userId_subjectId: { userId: order.userId, subjectId: item.subjectId } },
        create: { userId: order.userId, subjectId: item.subjectId, total: SUBJECT_TRYOUT_COUNT },
        update: { total: { increment: SUBJECT_TRYOUT_COUNT } },
      });
    }

    return tx.subjectTryOutOrder.update({
      where: { id },
      data: { status: "disetujui", disetujuiOlehAdminId: admin.id, disetujuiAt: now, catatanAdmin },
    });
  });

  await logAudit({
    userId: admin.id,
    aksi: "update",
    entitas: "subject_tryout_orders",
    entitasId: id,
    before: order,
    after: result,
    ip: getClientIp(request),
  });

  return NextResponse.json({ order: result });
}
