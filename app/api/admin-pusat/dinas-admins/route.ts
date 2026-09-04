import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { generateTempPassword } from "@/lib/utils/generate-code";
import { dinasAdminCreateSchema } from "@/lib/validations/dinas-pendidikan";

export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const dinasAdmins = await prisma.user.findMany({
    where: { role: "dinas_pendidikan" },
    select: { id: true, email: true, status: true },
    orderBy: { email: "asc" },
  });

  return NextResponse.json({ dinasAdmins });
}

/**
 * Admin pusat membuat akun dinas pendidikan (read-only, akses kesiapan TKA
 * lintas sekolah) - pola sama persis dengan pembuatan akun admin sekolah
 * (app/api/admin-pusat/school-admins), cuma tanpa baris penghubung sekolah
 * karena akses dinas memang lintas sekolah, bukan terikat 1 sekolah. Password
 * sementara HANYA dikembalikan sekali di response ini, tidak pernah disimpan.
 */
export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = dinasAdminCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { email, nama, instansi } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "Email ini sudah dipakai akun lain." }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { role: "dinas_pendidikan" },
    user_metadata: { must_change_password: true, nama, instansi },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: `Gagal membuat akun: ${error?.message ?? "unknown error"}` },
      { status: 502 },
    );
  }

  const user = await prisma.user.create({
    data: { id: data.user.id, email, role: "dinas_pendidikan", status: "aktif" },
  });

  await logAudit({
    userId: actor.id,
    aksi: "create",
    entitas: "users",
    entitasId: data.user.id,
    after: { userId: data.user.id, email, role: "dinas_pendidikan", instansi },
    ip: getClientIp(request),
  });

  return NextResponse.json({ user, tempPassword }, { status: 201 });
}
