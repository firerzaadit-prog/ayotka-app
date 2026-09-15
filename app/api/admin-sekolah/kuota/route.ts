import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";

/**
 * Status kursi (seat) sekolah - read-only, dipakai dashboard admin sekolah
 * supaya admin sekolah tahu kuota & masa berlaku tanpa perlu tanya admin
 * pusat. Pengelolaan (aktivasi/ubah) tetap cuma lewat admin pusat, lihat
 * /api/admin-pusat/schools/[id]/seat.
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

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { seatQuota: true, validUntil: true },
  });
  const seatsUsed = await prisma.entitlement.count({
    where: { schoolId, source: "school_seat", revokedAt: null },
  });

  return NextResponse.json({
    seatQuota: school?.seatQuota ?? null,
    validUntil: school?.validUntil ?? null,
    seatsUsed,
  });
}
