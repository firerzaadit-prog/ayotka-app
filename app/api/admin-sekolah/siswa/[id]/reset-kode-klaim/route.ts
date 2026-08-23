import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { generateReadableCode } from "@/lib/utils/generate-code";

type RouteParams = { params: Promise<{ id: string }> };

async function generateUniqueClaimToken(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const token = generateReadableCode(8);
    const existing = await prisma.student.findUnique({ where: { claimToken: token } });
    if (!existing) return token;
  }
  throw new Error("Gagal membuat kode klaim unik, coba lagi.");
}

/** Tiket 3.5: reset kode klaim bila hilang. Hanya berlaku untuk siswa yang belum klaim. */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.student.findUnique({ where: { id } });
  if (!before || before.deletedAt || !before.schoolId) {
    return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  }
  const allowedSchoolId = await resolveSchoolId(user, before.schoolId);
  if (allowedSchoolId !== before.schoolId) {
    return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  }

  if (before.claimStatus === "sudah_klaim") {
    return NextResponse.json(
      { error: "Siswa ini sudah klaim akun, kode klaim tidak berlaku lagi." },
      { status: 409 },
    );
  }

  const claimToken = await generateUniqueClaimToken();
  const student = await prisma.student.update({ where: { id }, data: { claimToken } });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "students",
    entitasId: id,
    before,
    after: student,
    ip: getClientIp(request),
  });

  return NextResponse.json({ student });
}
