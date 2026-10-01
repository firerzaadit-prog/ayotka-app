import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Prisma, Student } from "@prisma/client";

/**
 * Jendela buka/tutup paket & grup self-select. Kalau includeUpcoming (default
 * true di tampilan siswa /api/siswa/ujian), paket yang BELUM dibuka (bukaMulai
 * di masa depan, baik Mandiri maupun Nasional) tetap ikut dikembalikan agar
 * siswa bisa melihat seluruh daftar paket yang tersedia. Tombol "Mulai" tetap
 * dikunci di UI ("Belum Dibuka"), dan saat submit mulai attempt
 * (POST /api/siswa/attempts), server memastikan waktu bukaMulai sudah tiba.
 */
function windowFilter(now: Date, includeUpcoming: boolean): Prisma.PackageWhereInput[] {
  const open: Prisma.PackageWhereInput = {
    AND: [
      { OR: [{ bukaMulai: null }, { bukaMulai: { lte: now } }] },
      { OR: [{ bukaSelesai: null }, { bukaSelesai: { gte: now } }] },
    ],
  };
  if (!includeUpcoming) return [open];
  return [{ OR: [open, { bukaMulai: { gt: now } }] }];
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
  opts: { includeUpcoming?: boolean; includeUpcomingNasional?: boolean } = {},
) {
  const now = new Date();
  const includeUpcoming = opts.includeUpcoming ?? opts.includeUpcomingNasional ?? false;
  // bukaMulai/bukaSelesai null = selalu terbuka (perilaku lama, dipakai
  // default untuk paket Latihan tanpa jadwal). Ditulis sebagai AND terpisah
  // (bukan digabung ke OR) supaya tidak bentrok dengan key "OR" yang sudah
  // dipakai cabang Jalur A di bawah untuk logika visibility-nya sendiri.
  const baseWhere: Prisma.PackageWhereInput = {
    status: "published",
    jenjang: student.jenjang,
    AND: [
      ...windowFilter(now, includeUpcoming),
      {
        // Paket admin pusat = Try Out Mandiri/Nasional, selalu boleh dipilih
        // (visibilitasnya diatur targetSiswa + visibility di bawah). Paket
        // milik SEKOLAH tetap wajib bolehDipilihSiswa - kalau tidak, paket
        // yang sengaja hanya untuk Ujian Terjadwal (penugasan) ikut muncul di
        // daftar Try Out dan bisa dimulai kapan saja, melewati jendela jadwalnya.
        // (Dulu di sini ada `kategori in [mandiri, nasional]`, yang SELALU benar
        // karena enum cuma punya dua nilai itu - jadi flag ini tidak pernah berlaku.)
        OR: [{ bolehDipilihSiswa: true }, { ownerType: "pusat" }],
      },
    ],
  };

  const orderBy = [
    { urutanSeri: { sort: "asc" as const, nulls: "last" as const } },
    { nama: "asc" as const },
  ];

  if (student.jalur === "B") {
    return prisma.package.findMany({
      where: {
        ...baseWhere,
        targetSiswa: { in: ["mandiri", "semua"] },
        visibility: { some: { targetType: "publik" as const } },
      },
      orderBy,
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
    orderBy,
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
      package: { select: { nama: true, jumlahSoal: true, durasiMenit: true, subject: { select: { id: true, nama: true } } } },
    },
  });
}
