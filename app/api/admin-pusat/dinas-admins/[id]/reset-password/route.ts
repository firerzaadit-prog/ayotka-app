import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { getClientIp } from "@/lib/audit/log";
import { resetAkunOlehAdminPusat } from "@/lib/auth/reset-password-akun";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Reset kata sandi akun dinas pendidikan (id = id akun). Kata sandi sementara baru dikembalikan SEKALI di respons
 * dan pemiliknya wajib menggantinya saat login berikutnya (pola sama seperti admin sekolah).
 */
export async function POST(request: Request, { params }: RouteParams) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }
  const { id } = await params;
  return resetAkunOlehAdminPusat({ aktorId: actor.id, userId: id, peranDiharapkan: "dinas_pendidikan", ip: getClientIp(request) });
}
