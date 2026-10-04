import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { getClientIp } from "@/lib/audit/log";
import { resetAkunOlehAdminPusat } from "@/lib/auth/reset-password-akun";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Reset kata sandi akun admin sekolah (id = id akun). Kata sandi sementara baru dikembalikan SEKALI di respons dan
 * pemiliknya wajib menggantinya saat login berikutnya - untuk kasus kata sandi sementara saat pembuatan akun terlewat
 * dicatat (kata sandi itu tidak disimpan dan tidak bisa dilihat lagi) atau admin sekolah lupa dan tidak punya akses email.
 */
export async function POST(request: Request, { params }: RouteParams) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }
  const { id } = await params;
  return resetAkunOlehAdminPusat({ aktorId: actor.id, userId: id, peranDiharapkan: "admin_sekolah", ip: getClientIp(request) });
}
