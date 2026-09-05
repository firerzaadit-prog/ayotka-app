import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";

/**
 * Kuota try out per mata pelajaran yang sudah dijatah admin pusat utk
 * sekolah ini - read-only, dipakai dashboard & Kelola Siswa admin sekolah
 * supaya admin sekolah tahu berapa jatahnya tanpa perlu tanya admin pusat.
 * Pengelolaan (tambah/ubah/hapus) kuota tetap cuma lewat admin pusat, lihat
 * /api/admin-pusat/school-subject-quotas/[id].
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

  const quotas = await prisma.schoolSubjectQuota.findMany({
    where: { schoolId },
    include: { subject: { select: { id: true, nama: true, jenjang: true } } },
    orderBy: { subject: { nama: "asc" } },
  });

  return NextResponse.json({ quotas });
}
