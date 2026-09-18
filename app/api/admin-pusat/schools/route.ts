import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { generateReadableCode, generateTempPassword } from "@/lib/utils/generate-code";
import { createAdminClient } from "@/lib/supabase/admin";
import { schoolCreateSchema } from "@/lib/validations/school";

export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schools = await prisma.school.findMany({
    orderBy: { nama: "asc" },
    include: { _count: { select: { schoolUsers: true, students: true } } },
  });

  return NextResponse.json({ schools });
}

async function generateUniqueKodeSekolah(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReadableCode(6);
    const existing = await prisma.school.findUnique({ where: { kodeSekolah: code } });
    if (!existing) return code;
  }
  throw new Error("Gagal membuat kode sekolah unik, coba lagi.");
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schoolCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const kodeSekolah = await generateUniqueKodeSekolah();
  const { npsn, alamat, seatQuota, validUntil, adminEmail, adminNama, ...rest } = parsed.data;

  // Jika adminEmail diisi, pastikan email belum dipakai
  if (adminEmail) {
    const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existingUser) {
      return NextResponse.json(
        { error: `Email ${adminEmail} sudah digunakan oleh akun lain.` },
        { status: 409 },
      );
    }
  }

  try {
    const parsedValidUntil = validUntil ? new Date(validUntil) : null;
    const school = await prisma.school.create({
      data: {
        ...rest,
        npsn: npsn && npsn.length > 0 ? npsn : null,
        alamat: alamat && alamat.length > 0 ? alamat : null,
        kodeSekolah,
        status: "aktif",
        seatQuota: seatQuota ?? null,
        validUntil: parsedValidUntil,
        seatActivatedById: seatQuota ? user.id : null,
      },
    });

    let tempPasswordInfo: { email: string; password: string } | null = null;

    // Jika adminEmail diisi, buatkan akun admin sekolah pertama dengan password sementara
    if (adminEmail) {
      const tempPassword = generateTempPassword();
      const supabaseAdmin = createAdminClient();

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: tempPassword,
        email_confirm: true,
        app_metadata: { role: "admin_sekolah" },
        user_metadata: { must_change_password: true, nama: adminNama || parsed.data.nama },
      });

      if (!authError && authData.user) {
        await prisma.$transaction([
          prisma.user.create({
            data: { id: authData.user.id, email: adminEmail, role: "admin_sekolah", status: "aktif" },
          }),
          prisma.schoolUser.create({
            data: { userId: authData.user.id, schoolId: school.id },
          }),
        ]);

        tempPasswordInfo = { email: adminEmail, password: tempPassword };
      }
    }

    await logAudit({
      userId: user.id,
      aksi: "create",
      entitas: "schools",
      entitasId: school.id,
      after: { ...school, adminCreated: Boolean(tempPasswordInfo) },
      ip: getClientIp(request),
    });

    return NextResponse.json({ school, tempPassword: tempPasswordInfo }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "NPSN sudah terdaftar untuk sekolah lain." },
        { status: 409 },
      );
    }
    throw error;
  }
}
