import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";

/** Tidak ada peran Guru terpisah (Bagian 4 brief) - wali kelas dipilih dari akun admin sekolah itu sendiri. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schoolId = await resolveSchoolId(user, new URL(request.url).searchParams.get("schoolId"));
  if (!schoolId) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 400 });
  }

  const schoolUsers = await prisma.schoolUser.findMany({
    where: { schoolId },
    include: { user: { select: { id: true, email: true, username: true } } },
  });

  return NextResponse.json({ options: schoolUsers.map((su) => su.user) });
}
