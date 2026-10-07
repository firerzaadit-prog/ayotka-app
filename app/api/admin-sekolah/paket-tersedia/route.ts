import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { wherePaketTersedia } from "@/lib/exam/paket-tersedia";

/**
 * Tiket 4.2: paket yang bisa dipakai admin sekolah untuk Try Out Bersama - gabungan paket milik sekolah sendiri
 * DAN paket pusat yang didistribusikan ke sekolah ini (package_visibility, Tiket 2.8), keduanya harus terbit dan
 * ditujukan untuk siswa sekolah. Hanya paket jenjang SEKOLAH ini (siswa Jalur A selalu berjenjang sama dengan
 * sekolahnya, jadi paket jenjang lain pasti salah sasaran). Aturan yang sama ditegakkan lagi saat penugasan dibuat
 * (lib/exam/paket-tersedia.ts). Try Out Nasional tidak termasuk: hanya admin pusat yang menjalankannya. Beda dari GET /api/packages yang cuma mengembalikan paket milik sendiri (dipakai
 * halaman Bank Soal untuk kelola/edit, bukan untuk menugaskan).
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

  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { jenjang: true } });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  const packages = await prisma.package.findMany({
    where: wherePaketTersedia(schoolId, { jenjang: school.jenjang, termasukNasional: user.role === "admin_pusat" }),
    orderBy: { nama: "asc" },
    select: {
      id: true,
      nama: true,
      jumlahSoal: true,
      durasiMenit: true,
      jenjang: true,
      kategori: true,
      ownerType: true,
      publishedAt: true,
      subject: { select: { id: true, nama: true } },
    },
  });

  return NextResponse.json({
    jenjang: school.jenjang,
    packages: packages.map(({ ownerType, ...p }) => ({ ...p, dirilisPusat: ownerType === "pusat" })),
  });
}
