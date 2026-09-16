import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const group = await prisma.tryOutGroup.findUnique({
    where: { id },
    include: { packages: { where: { status: "published" }, select: { id: true } } },
  });
  if (!group || group.ownerId !== user.id) {
    return NextResponse.json({ error: "Try out tidak ditemukan." }, { status: 404 });
  }

  if (group.packages.length === 0) {
    return NextResponse.json(
      { error: "Belum ada variasi paket yang dipublish di dalam try out ini - publish minimal satu variasi dulu." },
      { status: 422 },
    );
  }

  const before = group;
  const updated = await prisma.tryOutGroup.update({
    where: { id },
    data: { status: "published", publishedAt: new Date() },
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "try_out_groups",
    entitasId: id,
    before,
    after: updated,
    ip: getClientIp(request),
  });

  return NextResponse.json({ group: updated });
}
