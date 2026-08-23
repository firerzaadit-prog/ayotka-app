import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { generateTempPassword } from "@/lib/utils/generate-code";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Tiket 3.4 (Bagian 3.1 brief): fallback reset password untuk siswa
 * berbasis NISN (email sintetis tidak bisa menerima link reset otomatis) -
 * admin sekolah generate password sementara, disampaikan lewat jalur lain
 * (bukan email/log), sama seperti pola reset akun admin sekolah di Tiket 1.5.
 */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student || student.deletedAt || !student.schoolId || !student.userId) {
    return NextResponse.json({ error: "Siswa belum punya akun untuk direset." }, { status: 404 });
  }
  const allowedSchoolId = await resolveSchoolId(user, student.schoolId);
  if (allowedSchoolId !== student.schoolId) {
    return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  }

  const tempPassword = generateTempPassword();
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(student.userId, {
    password: tempPassword,
    user_metadata: { must_change_password: true },
  });
  if (error) {
    return NextResponse.json({ error: `Gagal reset password: ${error.message}` }, { status: 502 });
  }

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "students",
    entitasId: id,
    after: { aksi: "reset_password" },
    ip: getClientIp(request),
  });

  return NextResponse.json({ tempPassword });
}
