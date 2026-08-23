import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import type { Jenjang } from "@prisma/client";

/** Bagian 0.1 keputusan #16 brief: SD dimulai kelas 4 (mentok 6), SMP mentok 9. */
const MAX_TINGKAT: Record<Jenjang, number> = { SD: 6, SMP: 9 };

/**
 * Tiket 3.6/4 (Bagian 4 & 7.2 brief): naik kelas massal. Memindahkan siswa
 * dari kelas tahun ajaran sebelumnya ke kelas tingkat berikutnya di tahun
 * ajaran yang sedang aktif, tanpa menghapus enrollment lama. Siswa di
 * tingkat akhir jenjangnya ditandai nonaktif (lulus) alih-alih dipindah.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const schoolId = await resolveSchoolId(user, body?.schoolId);
  if (!schoolId) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 400 });
  }

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
  if (!activeYear) {
    return NextResponse.json({ error: "Belum ada tahun ajaran aktif." }, { status: 400 });
  }

  const sourceClasses = await prisma.class.findMany({
    where: { schoolId, academicYearId: { not: activeYear.id } },
    include: { academicYear: true, studentEnrollments: true },
    orderBy: { academicYear: { mulai: "desc" } },
  });

  if (sourceClasses.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada kelas dari tahun ajaran sebelumnya untuk dinaikkan." },
      { status: 400 },
    );
  }

  const latestSourceYearId = sourceClasses[0]!.academicYearId;
  const classesToPromote = sourceClasses.filter((c) => c.academicYearId === latestSourceYearId);
  const maxTingkat = MAX_TINGKAT[school.jenjang];

  let dipindah = 0;
  let diluluskan = 0;

  await prisma.$transaction(async (tx) => {
    for (const kelas of classesToPromote) {
      const studentIds = kelas.studentEnrollments.map((e) => e.studentId);

      if (kelas.tingkat >= maxTingkat) {
        if (studentIds.length > 0) {
          await tx.student.updateMany({
            where: { id: { in: studentIds } },
            data: { status: "nonaktif" },
          });
          diluluskan += studentIds.length;
        }
        continue;
      }

      const destination = await tx.class.upsert({
        where: {
          schoolId_academicYearId_tingkat_namaRombel: {
            schoolId,
            academicYearId: activeYear.id,
            tingkat: kelas.tingkat + 1,
            namaRombel: kelas.namaRombel,
          },
        },
        create: {
          schoolId,
          academicYearId: activeYear.id,
          tingkat: kelas.tingkat + 1,
          namaRombel: kelas.namaRombel,
        },
        update: {},
      });

      if (studentIds.length > 0) {
        const result = await tx.studentEnrollment.createMany({
          data: studentIds.map((studentId) => ({
            studentId,
            classId: destination.id,
            academicYearId: activeYear.id,
          })),
          skipDuplicates: true,
        });
        dipindah += result.count;
      }
    }
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "students",
    entitasId: schoolId,
    after: { aksi: "naik_kelas", dipindah, diluluskan, tahunAjaranTujuan: activeYear.nama },
    ip: getClientIp(request),
  });

  return NextResponse.json({ dipindah, diluluskan });
}
