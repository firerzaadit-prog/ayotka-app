import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { servicePackageUpdateSchema } from "@/lib/validations/service-package";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.servicePackage.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Paket layanan tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = servicePackageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { deskripsi, ...rest } = parsed.data;
  const pkg = await prisma.servicePackage.update({
    where: { id },
    data: {
      ...rest,
      ...(deskripsi !== undefined ? { deskripsi: deskripsi || null } : {}),
    },
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "service_packages",
    entitasId: id,
    before,
    after: pkg,
    ip: getClientIp(request),
  });

  return NextResponse.json({ package: pkg });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.servicePackage.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Paket layanan tidak ditemukan." }, { status: 404 });
  }

  try {
    await prisma.servicePackage.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "Paket ini masih dipakai dalam order siswa, tidak bisa dihapus permanen." },
        { status: 409 },
      );
    }
    throw error;
  }

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "service_packages",
    entitasId: id,
    before,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
