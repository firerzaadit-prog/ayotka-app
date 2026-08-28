import "server-only";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";
import { isSchoolActive } from "@/lib/schools/active";
import type { Role, User } from "@prisma/client";

export type CurrentUser = Pick<
  User,
  "id" | "email" | "role" | "status" | "username"
>;

/**
 * Ambil user yang sedang login (Server Component/Route Handler/Server
 * Action - Node runtime). Role di tabel `users` (Prisma) adalah sumber
 * kebenaran untuk logic aplikasi; middleware.ts (Edge runtime, tidak bisa
 * akses Prisma) memakai salinan role di app_metadata Supabase Auth hanya
 * untuk gerbang cepat sebelum halaman dirender - lihat middleware.ts.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, email: true, role: true, status: true, username: true },
  });

  if (!user || user.status !== "aktif") return null;
  if (!(await hasActiveSchoolAccess(user.id, user.role))) return null;

  return user;
}

/**
 * Admin sekolah & siswa Jalur A terikat ke satu sekolah - kalau langganan
 * sekolahnya berakhir (atau di-suspend admin pusat), akses mereka wajib
 * putus juga, bukan cuma pendaftaran siswa baru yang ditolak (lihat
 * lib/schools/lookup.ts). Dipanggil dari getCurrentUser supaya berlaku di
 * SEMUA halaman & API route sekaligus (keduanya lewat fungsi ini/requireRole),
 * bukan cuma saat login pertama kali - sesi yang sedang berjalan pun ikut
 * putus begitu tanggal langganan lewat, sama seperti pola force-logout yang
 * sudah ada untuk akun yang di-nonaktifkan admin (lihat proxy.ts &
 * app/api/auth/force-logout/route.ts).
 *
 * Siswa Jalur B (mandiri) SENGAJA dilewati - mereka tidak terikat langganan
 * sekolah manapun, tapi langganan individu sendiri (lib/billing).
 */
export async function hasActiveSchoolAccess(userId: string, role: Role): Promise<boolean> {
  if (role === "admin_sekolah") {
    const schoolUser = await prisma.schoolUser.findFirst({
      where: { userId },
      select: { schoolId: true, school: { select: { status: true } } },
    });
    return Boolean(schoolUser && isSchoolActive(schoolUser.school));
  }

  if (role === "siswa") {
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { jalur: true, school: { select: { status: true } } },
    });
    if (!student || student.jalur !== "A") return true;
    return Boolean(student.school && isSchoolActive(student.school));
  }

  return true;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !roles.includes(user.role)) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
