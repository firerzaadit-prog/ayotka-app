import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { studentCreateSchema } from "@/lib/validations/student";
import { assertKuotaTersedia, createStudentWithEnrollment, KuotaPenuhError } from "@/lib/students/create";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const url = new URL(request.url);
  const schoolId = await resolveSchoolId(user, url.searchParams.get("schoolId"));
  if (!schoolId) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 400 });
  }

  const classId = url.searchParams.get("classId");

  const students = await prisma.student.findMany({
    where: {
      schoolId,
      jalur: "A",
      deletedAt: null,
      ...(classId
        ? { enrollments: { some: { classId } } }
        : {}),
    },
    orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
    include: {
      enrollments: {
        orderBy: { academicYear: { mulai: "desc" } },
        take: 1,
        include: { class: true },
      },
    },
  });

  return NextResponse.json({ students });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = studentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const kelas = await prisma.class.findUnique({ where: { id: parsed.data.classId } });
  if (!kelas) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  // Admin sekolah hanya boleh menambah siswa ke kelas sekolahnya sendiri.
  const allowedSchoolId = await resolveSchoolId(user, kelas.schoolId);
  if (allowedSchoolId !== kelas.schoolId) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  const school = await prisma.school.findUnique({ where: { id: kelas.schoolId } });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  try {
    await assertKuotaTersedia(school.id, 1);

    const student = await createStudentWithEnrollment({
      schoolId: school.id,
      jenjang: school.jenjang,
      nama: parsed.data.nama,
      nisn: parsed.data.nisn,
      tanggalLahir: parsed.data.tanggalLahir,
      classId: kelas.id,
      tingkat: kelas.tingkat,
      academicYearId: kelas.academicYearId,
    });

    await logAudit({
      userId: user.id,
      aksi: "create",
      entitas: "students",
      entitasId: student.id,
      after: student,
      ip: getClientIp(request),
    });

    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    if (error instanceof KuotaPenuhError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "NISN sudah dipakai siswa lain." }, { status: 409 });
    }
    throw error;
  }
}
