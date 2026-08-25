import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

/**
 * Tiket 7.3: daftar akun admin sekolah (lintas semua sekolah) untuk
 * dropdown filter di halaman Audit Log. Sengaja endpoint kecil terpisah,
 * bukan memperluas GET /api/admin-pusat/school-admins yang sudah punya
 * kontrak berbeda (wajib schoolId, dipakai halaman detail sekolah).
 */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schoolUsers = await prisma.schoolUser.findMany({
    include: { user: { select: { id: true, email: true } }, school: { select: { nama: true } } },
    orderBy: { school: { nama: "asc" } },
  });

  const options = schoolUsers.map((su) => ({
    userId: su.user.id,
    email: su.user.email,
    schoolNama: su.school.nama,
  }));

  return NextResponse.json({ options });
}
