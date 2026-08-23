import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { namaUpdateSchema } from "@/lib/validations/taxonomy";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = namaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const before = await prisma.subMateri.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Sub materi tidak ditemukan." }, { status: 404 });
  }

  const subMateri = await prisma.subMateri.update({ where: { id }, data: parsed.data });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "sub_materi",
    entitasId: id,
    before,
    after: subMateri,
    ip: getClientIp(request),
  });

  return NextResponse.json({ subMateri });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.subMateri.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Sub materi tidak ditemukan." }, { status: 404 });
  }

  try {
    await prisma.subMateri.delete({ where: { id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Sub materi ini sudah punya kompetensi, tidak bisa dihapus." },
        { status: 409 },
      );
    }
    throw error;
  }

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "sub_materi",
    entitasId: id,
    before,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
