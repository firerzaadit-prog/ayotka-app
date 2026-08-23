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

  const before = await prisma.materi.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Materi tidak ditemukan." }, { status: 404 });
  }

  const materi = await prisma.materi.update({ where: { id }, data: parsed.data });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "materi",
    entitasId: id,
    before,
    after: materi,
    ip: getClientIp(request),
  });

  return NextResponse.json({ materi });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.materi.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Materi tidak ditemukan." }, { status: 404 });
  }

  try {
    await prisma.materi.delete({ where: { id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Materi ini sudah punya sub materi/kompetensi, tidak bisa dihapus." },
        { status: 409 },
      );
    }
    throw error;
  }

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "materi",
    entitasId: id,
    before,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
