import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  kode: z.string().trim().min(1).optional(),
  deskripsi: z.string().trim().min(3).optional(),
  levelKognitif: z.enum(["C1", "C2", "C3", "C4", "C5", "C6"]).optional(),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const before = await prisma.kompetensi.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Kompetensi tidak ditemukan." }, { status: 404 });
  }

  const kompetensi = await prisma.kompetensi.update({ where: { id }, data: parsed.data });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "kompetensi",
    entitasId: id,
    before,
    after: kompetensi,
    ip: getClientIp(request),
  });

  return NextResponse.json({ kompetensi });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.kompetensi.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Kompetensi tidak ditemukan." }, { status: 404 });
  }

  try {
    await prisma.kompetensi.delete({ where: { id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Kompetensi ini sudah dipakai di kisi-kisi/soal, tidak bisa dihapus." },
        { status: 409 },
      );
    }
    throw error;
  }

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "kompetensi",
    entitasId: id,
    before,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
