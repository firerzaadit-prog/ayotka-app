import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { studentCreateSchema } from "@/lib/validations/student";
import { assertKuotaTersedia, createStudent, KuotaPenuhError } from "@/lib/students/create";

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

  // ?status=alumni -> siswa yang sudah ditandai lulus; bawaan: siswa aktif (belum lulus).
  const alumni = url.searchParams.get("status") === "alumni";
  const dasar = { schoolId, jalur: "A" as const, deletedAt: null };
  const [students, jumlahAktif, jumlahAlumni] = await Promise.all([
    prisma.student.findMany({
      where: { ...dasar, lulusAt: alumni ? { not: null } : null },
      orderBy: { nama: "asc" },
    }),
    prisma.student.count({ where: { ...dasar, lulusAt: null } }),
    prisma.student.count({ where: { ...dasar, lulusAt: { not: null } } }),
  ]);

  return NextResponse.json({ students, jumlah: { aktif: jumlahAktif, alumni: jumlahAlumni } });
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

  const schoolId = await resolveSchoolId(user, parsed.data.schoolId || null);
  if (!schoolId) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 400 });
  }

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  try {
    await assertKuotaTersedia(school.id, 1);

    const student = await createStudent({
      schoolId: school.id,
      jenjang: school.jenjang,
      nama: parsed.data.nama,
      nisn: parsed.data.nisn,
      tanggalLahir: parsed.data.tanggalLahir,
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
