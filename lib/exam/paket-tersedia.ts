import type { Jenjang, Prisma } from "@prisma/client";

/** Pesan bila admin sekolah mencoba menjadwalkan/membuat Try Out Nasional (hanya admin pusat yang boleh). */
export const PESAN_NASIONAL_ADMIN_PUSAT =
  "Try Out Nasional hanya dapat dijalankan oleh admin pusat. Sekolah tidak bisa menjadwalkan atau membuatnya sendiri.";

/**
 * Paket yang boleh dijadikan Try Out Bersama oleh sebuah sekolah: sudah terbit, ditujukan untuk siswa sekolah
 * (targetSiswa sekolah/semua, BUKAN yang khusus mandiri), dan milik sekolah itu sendiri ATAU paket pusat yang
 * didistribusikan ke sekolah ini (package_visibility semua / sekolah ini). Satu definisi untuk daftar pilihan
 * (GET paket-tersedia) dan pembuatan penugasan (POST assignments), supaya yang tidak muncul di pilihan juga tidak
 * bisa dipakai lewat permintaan langsung.
 *
 * `jenjang` opsional: bila diisi, hanya paket jenjang itu (jenjang sekolah). Dipisah supaya pembuatan penugasan bisa
 * membedakan "paket tidak tersedia" dari "paket jenjang lain" dan memberi pesan yang jelas.
 *
 * Try Out Nasional HANYA dijalankan admin pusat (keputusan user, 8 Okt 2026): admin sekolah tidak pernah melihat atau
 * bisa memilih paket nasional. `termasukNasional` hanya diberikan untuk admin pusat yang mengelola sekolah itu (mode
 * "Kelola Sekolah"); pemanggil yang perlu membedakan "paket nasional" dari "tidak tersedia" memintanya lalu memeriksa
 * kategori dan peran sendiri.
 *
 * ownerType "pusat" ditulis eksplisit pada cabang visibility: baris package_visibility yatim pada paket sekolah
 * tidak boleh membuatnya tersedia di sekolah lain.
 */
export function wherePaketTersedia(
  schoolId: string,
  opsi: { jenjang?: Jenjang; termasukNasional?: boolean } = {},
): Prisma.PackageWhereInput {
  return {
    status: "published",
    targetSiswa: { in: ["sekolah", "semua"] },
    ...(opsi.termasukNasional ? {} : { kategori: "mandiri" as const }),
    ...(opsi.jenjang ? { jenjang: opsi.jenjang } : {}),
    OR: [
      { ownerType: "sekolah", ownerId: schoolId },
      {
        ownerType: "pusat",
        visibility: {
          some: { OR: [{ targetType: "semua" }, { targetType: "sekolah", schoolId }] },
        },
      },
    ],
  };
}
