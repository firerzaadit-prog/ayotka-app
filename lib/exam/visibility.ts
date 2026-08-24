import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Student } from "@prisma/client";

/**
 * Tiket 4.4 (Bagian 3.2 brief, "Masuk ke Paket Soal - dua mode"): Mode B
 * (Latihan Mandiri) - paket yang boleh dipilih bebas siswa, difilter
 * otomatis per jenjang/tingkat siswa. Jalur B cuma boleh paket publik;
 * Jalur A boleh paket sekolahnya sendiri + paket pusat yang
 * didistribusikan ke sekolahnya.
 */
export async function getSelfSelectPackagesFor(student: Student) {
  const baseWhere = {
    status: "published" as const,
    bolehDipilihSiswa: true,
    jenjang: student.jenjang,
    tingkat: student.tingkat,
  };

  if (student.jalur === "B") {
    return prisma.package.findMany({
      where: { ...baseWhere, visibility: { some: { targetType: "publik" as const } } },
      orderBy: { nama: "asc" },
      include: { subject: true },
    });
  }

  if (!student.schoolId) return [];
  return prisma.package.findMany({
    where: {
      ...baseWhere,
      OR: [
        { ownerType: "sekolah" as const, ownerId: student.schoolId },
        {
          visibility: {
            some: {
              OR: [
                { targetType: "semua" as const },
                { targetType: "sekolah" as const, schoolId: student.schoolId },
              ],
            },
          },
        },
      ],
    },
    orderBy: { nama: "asc" },
    include: { subject: true },
  });
}

/**
 * Mode A (Ujian Terjadwal) - penugasan aktif yang jendela waktunya sedang
 * terbuka untuk kelas siswa saat ini (enrollment tahun ajaran aktif).
 */
export async function getActiveAssignmentsFor(student: Student) {
  if (student.jalur !== "A" || !student.schoolId) return [];

  const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
  if (!activeYear) return [];

  const enrollment = await prisma.studentEnrollment.findUnique({
    where: { studentId_academicYearId: { studentId: student.id, academicYearId: activeYear.id } },
  });

  const now = new Date();
  const classFilter = enrollment
    ? [{ classId: enrollment.classId }, { classId: null }]
    : [{ classId: null }];

  return prisma.assignment.findMany({
    where: {
      schoolId: student.schoolId,
      isActive: true,
      mulai: { lte: now },
      selesai: { gte: now },
      OR: classFilter,
    },
    orderBy: { selesai: "asc" },
    include: { package: { select: { nama: true, jumlahSoal: true, durasiMenit: true } } },
  });
}
