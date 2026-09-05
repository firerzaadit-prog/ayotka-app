import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";

/**
 * Tiket 4.2: paket yang bisa dipakai admin sekolah untuk penugasan ujian -
 * gabungan paket milik sekolah sendiri DAN paket pusat yang didistribusikan
 * ke sekolah ini (package_visibility, Tiket 2.8), keduanya harus published.
 * Beda dari GET /api/packages yang cuma mengembalikan paket milik sendiri
 * (dipakai halaman Bank Soal untuk kelola/edit, bukan untuk assign).
 */
export async function GET() {
  let user;
  try {
    user = await requireRole("admin_sekolah", "admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const packages = await prisma.package.findMany({
    where: {
      status: "published",
      targetSiswa: { in: ["sekolah", "semua"] },
      OR: [
        { ownerType: "sekolah", ownerId: schoolId },
        {
          // Distribusi lintas sekolah (visibility) cuma konsep milik paket
          // pusat (Tiket 2.8) - ownerType eksplisit di sini supaya baris
          // package_visibility yatim/tidak seharusnya ada di paket sekolah
          // tetap tidak pernah membuatnya "tersedia" di sekolah lain.
          ownerType: "pusat",
          visibility: {
            some: { OR: [{ targetType: "semua" }, { targetType: "sekolah", schoolId }] },
          },
        },
      ],
    },
    orderBy: { nama: "asc" },
    include: { subject: true },
  });

  return NextResponse.json({ packages });
}
