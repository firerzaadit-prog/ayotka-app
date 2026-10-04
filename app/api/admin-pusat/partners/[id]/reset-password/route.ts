import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { getClientIp } from "@/lib/audit/log";
import { resetAkunOlehAdminPusat } from "@/lib/auth/reset-password-akun";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Reset kata sandi akun mitra (id = id MITRA, bukan id akun, sesuai daftar mitra di halaman Mitra & Voucher).
 * Kata sandi sementara baru dikembalikan SEKALI di respons dan mitra wajib menggantinya saat login berikutnya.
 */
export async function POST(request: Request, { params }: RouteParams) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }
  const { id } = await params;
  const mitra = await prisma.partner.findUnique({ where: { id }, select: { userId: true } });
  if (!mitra) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }
  return resetAkunOlehAdminPusat({ aktorId: actor.id, userId: mitra.userId, peranDiharapkan: "mitra", ip: getClientIp(request) });
}
