import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";

type RouteParams = { params: Promise<{ id: string }> };

/** Aktivasi eksplisit satu tahun ajaran - otomatis menonaktifkan yang lain. */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.academicYear.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Tahun ajaran tidak ditemukan." }, { status: 404 });
  }

  const academicYear = await prisma.$transaction(async (tx) => {
    await tx.academicYear.updateMany({ data: { isActive: false }, where: { isActive: true } });
    return tx.academicYear.update({ where: { id }, data: { isActive: true } });
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "academic_years",
    entitasId: id,
    before,
    after: academicYear,
    ip: getClientIp(request),
  });

  return NextResponse.json({ academicYear });
}
