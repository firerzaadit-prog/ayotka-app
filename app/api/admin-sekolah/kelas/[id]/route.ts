import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { classUpdateSchema } from "@/lib/validations/class";

type RouteParams = { params: Promise<{ id: string }> };

async function loadOwnedClass(user: Awaited<ReturnType<typeof requireRole>>, id: string) {
  const kelas = await prisma.class.findUnique({ where: { id } });
  if (!kelas) return null;
  const schoolId = await resolveSchoolId(user, kelas.schoolId);
  if (schoolId !== kelas.schoolId) return null;
  return kelas;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await loadOwnedClass(user, id);
  if (!before) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = classUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { waliKelasId, ...rest } = parsed.data;
  const kelas = await prisma.class.update({
    where: { id },
    data: {
      ...rest,
      ...(waliKelasId !== undefined
        ? { waliKelasId: waliKelasId.length > 0 ? waliKelasId : null }
        : {}),
    },
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "classes",
    entitasId: id,
    before,
    after: kelas,
    ip: getClientIp(request),
  });

  return NextResponse.json({ class: kelas });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await loadOwnedClass(user, id);
  if (!before) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  try {
    await prisma.class.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "Rombel ini masih punya siswa/penugasan, tidak bisa dihapus." },
        { status: 409 },
      );
    }
    throw error;
  }

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "classes",
    entitasId: id,
    before,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
