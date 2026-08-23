import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";

type RouteParams = { params: Promise<{ id: string; itemId: string }> };

export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: blueprintId, itemId } = await params;
  const before = await prisma.blueprintItem.findUnique({ where: { id: itemId } });
  if (!before || before.blueprintId !== blueprintId) {
    return NextResponse.json({ error: "Item tidak ditemukan." }, { status: 404 });
  }

  await prisma.blueprintItem.delete({ where: { id: itemId } });

  const agg = await prisma.blueprintItem.aggregate({
    where: { blueprintId },
    _sum: { jumlahSoal: true },
  });
  await prisma.blueprint.update({
    where: { id: blueprintId },
    data: { totalSoal: agg._sum.jumlahSoal ?? 0 },
  });

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "blueprint_items",
    entitasId: itemId,
    before,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
