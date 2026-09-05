import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import type { CurrentUser } from "@/lib/auth/session";

/**
 * Nama cookie mode "Kelola Sekolah" (admin pusat mengelola satu sekolah lewat
 * halaman admin sekolah yang sama persis, lihat app/admin-sekolah/layout.tsx
 * dan app/api/admin-pusat/act-as-school/route.ts). HttpOnly, di-set/dihapus
 * hanya lewat endpoint act-as-school itu.
 */
export const ACTING_AS_SCHOOL_COOKIE = "ayotka_acting_school";

/**
 * Admin sekolah selalu terikat ke satu sekolah lewat SchoolUser. Admin pusat
 * beroperasi lintas sekolah, jadi schoolId-nya harus datang dari parameter
 * request (query/body) - fungsi ini yang menyeragamkan resolusinya supaya
 * admin sekolah tidak pernah bisa menyentuh data sekolah lain lewat parameter
 * yang dipalsukan. Kalau admin pusat tidak mengirim schoolId eksplisit
 * (dipanggil dari route/halaman yang sama persis dengan admin sekolah, lewat
 * mode "Kelola Sekolah"), fallback ke cookie acting-as-school yang di-set
 * lewat endpoint act-as-school - bukan sumber otorisasi baru, cuma menaruh
 * "sekolah mana" di tempat yang sama untuk kedua role supaya halaman admin
 * sekolah bisa dipakai ulang tanpa diubah satu-satu.
 */
export async function resolveSchoolId(
  user: CurrentUser,
  requestedSchoolId?: string | null,
): Promise<string | null> {
  if (user.role === "admin_sekolah") {
    const schoolUser = await prisma.schoolUser.findFirst({ where: { userId: user.id } });
    return schoolUser?.schoolId ?? null;
  }

  if (user.role === "admin_pusat") {
    if (requestedSchoolId && requestedSchoolId.length > 0) return requestedSchoolId;
    const cookieStore = await cookies();
    const acting = cookieStore.get(ACTING_AS_SCHOOL_COOKIE)?.value;
    return acting && acting.length > 0 ? acting : null;
  }

  return null;
}
