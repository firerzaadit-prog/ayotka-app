import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { assertKuotaTersedia, KuotaPenuhError } from "@/lib/students/create";

type RouteParams = { params: Promise<{ id: string }> };
const pindahSchema = z.object({ classId: z.string().uuid() });

/**
 * Tiket 3.7 (Bagian 7.2 brief): pindah sekolah - enrollment tahun berjalan
 * di sekolah lama diganti (bukan dihapus permanen dari riwayat: hanya
 * enrollment tahun AKTIF yang dipindah, tahun-tahun sebelumnya tetap
 * melekat ke sekolah lama karena beda academic_year_id). Lintas sekolah,
 * jadi khusus admin pusat - bukan wewenang admin sekolah asal/tujuan sepihak.
 */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = pindahSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Kelas tujuan wajib diisi." }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student || student.deletedAt || student.jalur !== "A" || !student.schoolId) {
    return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  }

  const destinationClass = await prisma.class.findUnique({
    where: { id: parsed.data.classId },
    include: { school: true },
  });
  if (!destinationClass) {
    return NextResponse.json({ error: "Kelas tujuan tidak ditemukan." }, { status: 404 });
  }
  if (destinationClass.schoolId === student.schoolId) {
    return NextResponse.json({ error: "Siswa sudah ada di sekolah ini." }, { status: 400 });
  }

  try {
    await assertKuotaTersedia(destinationClass.schoolId, 1);
  } catch (error) {
    if (error instanceof KuotaPenuhError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  const before = student;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.studentEnrollment.deleteMany({
      where: { studentId: id, academicYearId: destinationClass.academicYearId },
    });
    await tx.studentEnrollment.create({
      data: {
        studentId: id,
        classId: destinationClass.id,
        academicYearId: destinationClass.academicYearId,
      },
    });
    return tx.student.update({
      where: { id },
      data: {
        schoolId: destinationClass.schoolId,
        jenjang: destinationClass.school.jenjang,
        tingkat: destinationClass.tingkat,
      },
    });
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "students",
    entitasId: id,
    before,
    after: { aksi: "pindah_sekolah", schoolIdBaru: destinationClass.schoolId },
    ip: getClientIp(request),
  });

  return NextResponse.json({ student: updated });
}
