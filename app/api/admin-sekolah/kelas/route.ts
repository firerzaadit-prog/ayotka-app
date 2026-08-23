import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { classCreateSchema } from "@/lib/validations/class";

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

  const academicYearId =
    url.searchParams.get("academicYearId") ??
    (await prisma.academicYear.findFirst({ where: { isActive: true } }))?.id;
  if (!academicYearId) {
    return NextResponse.json({ error: "Belum ada tahun ajaran aktif." }, { status: 400 });
  }

  const classes = await prisma.class.findMany({
    where: { schoolId, academicYearId },
    orderBy: [{ tingkat: "asc" }, { namaRombel: "asc" }],
    include: {
      waliKelas: { select: { id: true, email: true, username: true } },
      academicYear: true,
      _count: { select: { studentEnrollments: true } },
    },
  });

  return NextResponse.json({ classes, academicYearId });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = classCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const schoolId = await resolveSchoolId(user, parsed.data.schoolId);
  if (!schoolId) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 400 });
  }

  const academicYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
  if (!academicYear) {
    return NextResponse.json({ error: "Belum ada tahun ajaran aktif." }, { status: 400 });
  }

  const { waliKelasId, tingkat, namaRombel } = parsed.data;

  const existing = await prisma.class.findFirst({
    where: { schoolId, academicYearId: academicYear.id, tingkat, namaRombel },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Rombel "${namaRombel}" tingkat ${tingkat} sudah ada di tahun ajaran ini.` },
      { status: 409 },
    );
  }

  const kelas = await prisma.class.create({
    data: {
      schoolId,
      academicYearId: academicYear.id,
      tingkat,
      namaRombel,
      waliKelasId: waliKelasId && waliKelasId.length > 0 ? waliKelasId : null,
    },
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "classes",
    entitasId: kelas.id,
    after: kelas,
    ip: getClientIp(request),
  });

  return NextResponse.json({ class: kelas }, { status: 201 });
}
