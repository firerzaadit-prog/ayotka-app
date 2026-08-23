import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { CurrentUser } from "@/lib/auth/session";

/**
 * Admin sekolah selalu terikat ke satu sekolah lewat SchoolUser. Admin pusat
 * beroperasi lintas sekolah, jadi schoolId-nya harus datang dari parameter
 * request (query/body), bukan dari sesi - fungsi ini yang menyeragamkan
 * resolusinya supaya admin sekolah tidak pernah bisa menyentuh data sekolah
 * lain lewat parameter yang dipalsukan.
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
    return requestedSchoolId && requestedSchoolId.length > 0 ? requestedSchoolId : null;
  }

  return null;
}
