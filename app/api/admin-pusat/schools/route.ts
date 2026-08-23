import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { generateReadableCode } from "@/lib/utils/generate-code";
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
  const { npsn, alamat, ...rest } = parsed.data;

  try {
    const school = await prisma.school.create({
      data: {
        ...rest,
        npsn: npsn && npsn.length > 0 ? npsn : null,
        alamat: alamat && alamat.length > 0 ? alamat : null,
        kodeSekolah,
      },
    });

    await logAudit({
      userId: user.id,
      aksi: "create",
      entitas: "schools",
      entitasId: school.id,
      after: school,
      ip: getClientIp(request),
    });

    return NextResponse.json({ school }, { status: 201 });
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
