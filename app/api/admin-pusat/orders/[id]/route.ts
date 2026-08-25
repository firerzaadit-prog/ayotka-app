import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { orderReviewSchema } from "@/lib/validations/order";
import { computeRenewalPeriod } from "@/lib/billing/subscription-status";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Tiket 6.4 + 6.7: ACC/tolak order siswa mandiri lewat endpoint yang sama.
 * ACC otomatis aktivasi/perpanjang: kalau user sudah punya subscription
 * yang masih usable (aktif/tenggang) saat ini, order ini dianggap
 * PERPANJANGAN - subscription baru mulai dari berakhir_at yang lama
 * (bukan dari hari ini), supaya sisa masa aktif yang belum terpakai tidak
 * hilang. Kalau tidak (baru pertama kali atau sudah lama kedaluwarsa),
 * mulai dari sekarang.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  let admin;
  try {
    admin = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { plan: true } });
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
    const updated = await prisma.order.update({
      where: { id },
      data: { status: "ditolak", disetujuiOlehAdminId: admin.id, disetujuiAt: now, catatanAdmin },
    });

    await logAudit({
      userId: admin.id,
      aksi: "update",
      entitas: "orders",
      entitasId: id,
      before: order,
      after: updated,
      ip: getClientIp(request),
    });

    return NextResponse.json({ order: updated });
  }

  const result = await prisma.$transaction(async (tx) => {
    const currentSub = await tx.subscription.findFirst({
      where: { userId: order.userId, status: { not: "batal" } },
      orderBy: { berakhirAt: "desc" },
    });
    const { mulaiAt, berakhirAt, isRenewal } = computeRenewalPeriod(
      currentSub,
      order.plan.durasiHari,
      now,
    );

    const subscription = await tx.subscription.create({
      data: {
        userId: order.userId,
        planId: order.planId,
        mulaiAt,
        berakhirAt,
        status: "aktif",
        orderId: order.id,
        diperpanjangOlehAdminId: isRenewal ? admin.id : null,
      },
    });

    const updatedOrder = await tx.order.update({
      where: { id },
      data: { status: "disetujui", disetujuiOlehAdminId: admin.id, disetujuiAt: now, catatanAdmin },
    });

    return { subscription, order: updatedOrder };
  });

  await logAudit({
    userId: admin.id,
    aksi: "update",
    entitas: "orders",
    entitasId: id,
    before: order,
    after: result.order,
    ip: getClientIp(request),
  });
  await logAudit({
    userId: admin.id,
    aksi: "create",
    entitas: "subscriptions",
    entitasId: result.subscription.id,
    after: result.subscription,
    ip: getClientIp(request),
  });

  return NextResponse.json(result);
}
