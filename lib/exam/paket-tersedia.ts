import type { Jenjang, Prisma } from "@prisma/client";

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
 * ownerType "pusat" ditulis eksplisit pada cabang visibility: baris package_visibility yatim pada paket sekolah
 * tidak boleh membuatnya tersedia di sekolah lain.
 */
export function wherePaketTersedia(schoolId: string, opsi: { jenjang?: Jenjang } = {}): Prisma.PackageWhereInput {
  return {
    status: "published",
    targetSiswa: { in: ["sekolah", "semua"] },
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
