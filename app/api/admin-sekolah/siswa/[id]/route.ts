import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { studentUpdateSchema } from "@/lib/validations/student";

type RouteParams = { params: Promise<{ id: string }> };

async function loadOwnedStudent(user: Awaited<ReturnType<typeof requireRole>>, id: string) {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student || student.deletedAt || !student.schoolId) return null;
  const allowedSchoolId = await resolveSchoolId(user, student.schoolId);
  if (allowedSchoolId !== student.schoolId) return null;
  return student;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await loadOwnedStudent(user, id);
  if (!before) {
    return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = studentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { classId, nisn, ...rest } = parsed.data;

  try {
    const student = await prisma.$transaction(async (tx) => {
      if (classId) {
        const kelas = await tx.class.findUnique({ where: { id: classId } });
        if (!kelas || kelas.schoolId !== before.schoolId) {
          throw new Error("KELAS_TIDAK_VALID");
        }
        await tx.studentEnrollment.upsert({
          where: { studentId_academicYearId: { studentId: id, academicYearId: kelas.academicYearId } },
          create: { studentId: id, classId, academicYearId: kelas.academicYearId },
          update: { classId },
        });
      }

      return tx.student.update({
        where: { id },
        data: { ...rest, ...(nisn !== undefined ? { nisn: nisn.length > 0 ? nisn : null } : {}) },
      });
    });

    await logAudit({
      userId: user.id,
      aksi: "update",
      entitas: "students",
      entitasId: id,
      before,
      after: student,
      ip: getClientIp(request),
    });

    return NextResponse.json({ student });
  } catch (error) {
    if (error instanceof Error && error.message === "KELAS_TIDAK_VALID") {
      return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "NISN sudah dipakai siswa lain." }, { status: 409 });
    }
    throw error;
  }
}

/** Tiket 3.7 (Bagian 7.2 brief): soft delete - riwayat attempt/nilai tetap ada, login dinonaktifkan. */
export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await loadOwnedStudent(user, id);
  if (!before) {
    return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  }

  const student = await prisma.$transaction(async (tx) => {
    if (before.userId) {
      await tx.user.update({ where: { id: before.userId }, data: { status: "nonaktif" } });
    }
    return tx.student.update({
      where: { id },
      data: { deletedAt: new Date(), status: "nonaktif" },
    });
  });

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "students",
    entitasId: id,
    before,
    after: student,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
