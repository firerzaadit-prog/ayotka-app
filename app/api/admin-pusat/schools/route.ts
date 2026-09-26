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

  // Akun admin sekolah dibuat DULU (kalau diminta): kalau gagal, sekolah tidak
  // ikut disimpan. Dulu sekolah tetap tersimpan tanpa admin dan responsnya tetap
  // 201, jadi admin pusat mengira akunnya sudah jadi.
  let adminAuth: { id: string; email: string; password: string } | null = null;
  if (adminEmail) {
    const tempPassword = generateTempPassword();
    const { data: authData, error: authError } = await createAdminClient().auth.admin.createUser({
      email: adminEmail,
      password: tempPassword,
      email_confirm: true,
      app_metadata: { role: "admin_sekolah" },
      user_metadata: { must_change_password: true, nama: adminNama || parsed.data.nama },
    });
    if (authError || !authData.user) {
      console.error("[admin-pusat/schools] gagal membuat akun admin sekolah:", authError);
      return NextResponse.json(
        { error: "Akun admin sekolah gagal dibuat, jadi sekolah belum disimpan. Periksa emailnya lalu coba lagi." },
        { status: 502 },
      );
    }
    adminAuth = { id: authData.user.id, email: adminEmail, password: tempPassword };
  }

  try {
    const parsedValidUntil = validUntil ? new Date(validUntil) : null;
    // Satu transaksi: sekolah + baris akun admin tersimpan bersama atau tidak sama sekali.
    const school = await prisma.$transaction(async (tx) => {
      const created = await tx.school.create({
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
      if (adminAuth) {
        await tx.user.create({
          data: { id: adminAuth.id, email: adminAuth.email, role: "admin_sekolah", status: "aktif" },
        });
        await tx.schoolUser.create({ data: { userId: adminAuth.id, schoolId: created.id } });
      }
      return created;
    });

    const tempPasswordInfo = adminAuth ? { email: adminAuth.email, password: adminAuth.password } : null;

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
    // Sekolah gagal disimpan: akun login admin yang sudah terlanjur dibuat
    // dihapus lagi supaya emailnya bisa dipakai saat mencoba ulang.
    if (adminAuth) {
      await createAdminClient().auth.admin.deleteUser(adminAuth.id).catch(() => {});
    }
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
