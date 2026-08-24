import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { assignmentUpdateSchema } from "@/lib/validations/assignment";

type RouteParams = { params: Promise<{ id: string }> };

async function loadOwned(schoolId: string, id: string) {
  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (!assignment || assignment.schoolId !== schoolId) return null;
  return assignment;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const { id } = await params;
  const before = await loadOwned(schoolId, id);
  if (!before) {
    return NextResponse.json({ error: "Penugasan tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = assignmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const assignment = await prisma.assignment.update({ where: { id }, data: parsed.data });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "assignments",
    entitasId: id,
    before,
    after: assignment,
    ip: getClientIp(request),
  });

  return NextResponse.json({ assignment });
}
