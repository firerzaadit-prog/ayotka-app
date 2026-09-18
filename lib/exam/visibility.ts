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
  const now = new Date();
  // bukaMulai/bukaSelesai null = selalu terbuka (perilaku lama, dipakai
  // default untuk paket Latihan tanpa jadwal). Ditulis sebagai AND terpisah
  // (bukan digabung ke OR) supaya tidak bentrok dengan key "OR" yang sudah
  // dipakai cabang Jalur A di bawah untuk logika visibility-nya sendiri.
  const baseWhere = {
    status: "published" as const,
    bolehDipilihSiswa: true,
    jenjang: student.jenjang,
    tingkatList: { has: student.tingkat },
    AND: [
      { OR: [{ bukaMulai: null }, { bukaMulai: { lte: now } }] },
      { OR: [{ bukaSelesai: null }, { bukaSelesai: { gte: now } }] },
    ],
  };

  if (student.jalur === "B") {
    return prisma.package.findMany({
      where: {
        ...baseWhere,
        targetSiswa: { in: ["mandiri", "semua"] },
        visibility: { some: { targetType: "publik" as const } },
      },
      orderBy: { nama: "asc" },
      include: { subject: true },
    });
  }

  if (!student.schoolId) return [];
  return prisma.package.findMany({
    where: {
      ...baseWhere,
      targetSiswa: { in: ["sekolah", "semua"] },
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
 * Bagian 8/10 (permintaan user, "paket soal yang banyak, diacak"): sama
 * persis polanya dengan getSelfSelectPackagesFor di atas, tapi untuk
 * TryOutGroup - siswa lihat SATU entri per grup (bukan satu per variasi),
 * sistem baru memilih satu variasi published SECARA ACAK saat attempt
 * dibuat (lihat app/api/siswa/attempts/route.ts). Grup dengan nol variasi
 * published sengaja disaring - tidak ada apa pun untuk benar-benar
 * dikerjakan siswa kalau ditampilkan.
 */
export async function getSelfSelectTryOutGroupsFor(student: Student) {
  const now = new Date();
  const baseWhere = {
    status: "published" as const,
    jenjang: student.jenjang,
    tingkatList: { has: student.tingkat },
    packages: { some: { status: "published" as const } },
    AND: [
      { OR: [{ bukaMulai: null }, { bukaMulai: { lte: now } }] },
      { OR: [{ bukaSelesai: null }, { bukaSelesai: { gte: now } }] },
    ],
  };

  if (student.jalur === "B") {
    return prisma.tryOutGroup.findMany({
      where: {
        ...baseWhere,
        targetSiswa: { in: ["mandiri", "semua"] },
        visibility: { some: { targetType: "publik" as const } },
      },
      orderBy: { nama: "asc" },
      include: { subject: true },
    });
  }

  if (!student.schoolId) return [];
  return prisma.tryOutGroup.findMany({
    where: {
      ...baseWhere,
      targetSiswa: { in: ["sekolah", "semua"] },
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
    include: {
      package: { select: { nama: true, jumlahSoal: true, durasiMenit: true, subject: { select: { nama: true } } } },
    },
  });
}
