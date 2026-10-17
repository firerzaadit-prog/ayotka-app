import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { generateTempPassword } from "@/lib/utils/generate-code";
import { schoolAdminCreateSchema } from "@/lib/validations/school-admin";
import { kirimEmailAkunBaru } from "@/lib/email/akun-baru";
import { asalPublik } from "@/lib/utils/asal-publik";

export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schoolId = new URL(request.url).searchParams.get("schoolId");
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId wajib diisi." }, { status: 400 });
  }

  const schoolAdmins = await prisma.schoolUser.findMany({
    where: { schoolId },
    include: { user: true },
  });

  return NextResponse.json({ schoolAdmins });
}

/**
 * Tiket 1.5: admin pusat membuat akun admin sekolah dengan password
 * sementara acak. Password dikembalikan sekali di response ini (cadangan untuk
 * disampaikan admin pusat lewat jalur lain) - tidak pernah disimpan di
 * database maupun log. Detail login JUGA dikirim ke email akun (Resend, lalu
 * Mailketing, lalu Gmail/SMTP bila diatur; lihat lib/email/akun-baru.ts)
 * kecuali kirimEmail=false; gagal kirim tidak menggagalkan pembuatan akun,
 * hasilnya ada di emailLogin. Akun wajib ganti password saat login pertama
 * (ditandai must_change_password, ditegakkan proxy.ts).
 */
export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schoolAdminCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { schoolId, email, nama } = parsed.data;

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "Email ini sudah dipakai akun lain." },
      { status: 409 },
    );
  }

  const tempPassword = generateTempPassword();
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { role: "admin_sekolah" },
    user_metadata: { must_change_password: true, nama },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: `Gagal membuat akun: ${error?.message ?? "unknown error"}` },
      { status: 502 },
    );
  }

  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: { id: data.user.id, email, role: "admin_sekolah", status: "aktif" },
    }),
    prisma.schoolUser.create({
      data: { userId: data.user.id, schoolId },
    }),
  ]);

  await logAudit({
    userId: actor.id,
    aksi: "create",
    entitas: "school_users",
    entitasId: `${data.user.id}:${schoolId}`,
    after: { userId: data.user.id, schoolId, email },
    ip: getClientIp(request),
  });

  const emailLogin =
    parsed.data.kirimEmail === false
      ? null
      : await kirimEmailAkunBaru({
          peran: "admin_sekolah",
          nama,
          email,
          passwordSementara: tempPassword,
          konteks: school.nama,
          asal: asalPublik(request),
        });

  return NextResponse.json({ user, tempPassword, emailLogin }, { status: 201 });
}
