import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { ACTING_AS_SCHOOL_COOKIE } from "@/lib/schools/scope";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

/**
 * Masuk/keluar mode "Kelola Sekolah" - admin pusat mengelola satu sekolah
 * lewat halaman admin sekolah yang sama persis (Kelas/Siswa/Ujian/Analitik),
 * konteks "sekolah mana" disimpan di cookie HttpOnly (lihat resolveSchoolId
 * di lib/schools/scope.ts), bukan lewat akun/login terpisah.
 */
export async function POST(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const schoolId = typeof body?.schoolId === "string" ? body.schoolId : null;
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId wajib diisi." }, { status: 400 });
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, nama: true },
  });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  const response = NextResponse.json({ school });
  response.cookies.set(ACTING_AS_SCHOOL_COOKIE, school.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ACTING_AS_SCHOOL_COOKIE);
  return response;
}
