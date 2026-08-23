import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { blueprintItemCreateSchema } from "@/lib/validations/blueprint";

type RouteParams = { params: Promise<{ id: string }> };

async function recomputeTotalSoal(blueprintId: string) {
  const agg = await prisma.blueprintItem.aggregate({
    where: { blueprintId },
    _sum: { jumlahSoal: true },
  });
  await prisma.blueprint.update({
    where: { id: blueprintId },
    data: { totalSoal: agg._sum.jumlahSoal ?? 0 },
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: blueprintId } = await params;
  const blueprint = await prisma.blueprint.findUnique({ where: { id: blueprintId } });
  if (!blueprint) {
    return NextResponse.json({ error: "Kisi-kisi tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = blueprintItemCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const item = await prisma.blueprintItem.create({
    data: { ...parsed.data, blueprintId },
  });
  await recomputeTotalSoal(blueprintId);

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "blueprint_items",
    entitasId: item.id,
    after: item,
    ip: getClientIp(request),
  });

  return NextResponse.json({ item }, { status: 201 });
}
