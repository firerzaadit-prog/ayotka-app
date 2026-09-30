import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Student } from "@prisma/client";

/**
 * Jendela buka/tutup paket & grup self-select. Kalau includeUpcomingNasional,
 * event kategori "nasional" yang BELUM dibuka (bukaMulai di masa depan) ikut
 * dikembalikan supaya siswa bisa melihat jadwalnya - tombol Mulai tetap
 * dikunci di UI, dan POST /api/siswa/attempts memanggil fungsi ini TANPA
 * opsi itu sehingga server tidak pernah membiarkan event belum-buka dimulai.
 */
function windowFilter(now: Date, includeUpcomingNasional: boolean) {
  const open = {
    AND: [
      { OR: [{ bukaMulai: null }, { bukaMulai: { lte: now } }] },
      { OR: [{ bukaSelesai: null }, { bukaSelesai: { gte: now } }] },
    ],
  };
  if (!includeUpcomingNasional) return [open];
  return [{ OR: [open, { kategori: "nasional" as const, bukaMulai: { gt: now } }] }];
}

/**
 * Tiket 4.4 (Bagian 3.2 brief, "Masuk ke Paket Soal - dua mode"): Mode B
 * (Latihan Mandiri) - paket yang boleh dipilih bebas siswa, difilter
 * otomatis per jenjang siswa (TKA lintas-jenjang, tidak ada tingkat/kelas -
 * lihat keputusan penghapusan tingkat 1 Okt 2026). Jalur B cuma boleh paket
 * publik; Jalur A boleh paket sekolahnya sendiri + paket pusat yang
 * didistribusikan ke sekolahnya.
 */
export async function getSelfSelectPackagesFor(
  student: Student,
  opts: { includeUpcomingNasional?: boolean } = {},
) {
  const now = new Date();
  // bukaMulai/bukaSelesai null = selalu terbuka (perilaku lama, dipakai
  // default untuk paket Latihan tanpa jadwal). Ditulis sebagai AND terpisah
  // (bukan digabung ke OR) supaya tidak bentrok dengan key "OR" yang sudah
  // dipakai cabang Jalur A di bawah untuk logika visibility-nya sendiri.
  const baseWhere = {
    status: "published" as const,
    bolehDipilihSiswa: true,
    jenjang: student.jenjang,
    AND: windowFilter(now, opts.includeUpcomingNasional ?? false),
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
 * Mode A (Ujian Terjadwal) - penugasan aktif yang jendela waktunya sedang
 * terbuka untuk sekolah siswa (target seluruh sekolah, bukan per rombel -
 * fitur Kelas/Rombel dihapus total 1 Okt 2026).
 */
export async function getActiveAssignmentsFor(student: Student) {
  if (student.jalur !== "A" || !student.schoolId) return [];

  const now = new Date();
  return prisma.assignment.findMany({
    where: {
      schoolId: student.schoolId,
      isActive: true,
      mulai: { lte: now },
      selesai: { gte: now },
    },
    orderBy: { selesai: "asc" },
    include: {
      package: { select: { nama: true, jumlahSoal: true, durasiMenit: true, subject: { select: { nama: true } } } },
    },
  });
}
