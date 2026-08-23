import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";

type RouteParams = { params: Promise<{ id: string }> };

/** Tiket 3.3: aktivasi manual sementara siswa mandiri, pengganti alur approval bukti transfer Fase 6. */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.student.findUnique({ where: { id } });
  if (!before || before.jalur !== "B" || before.deletedAt) {
    return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  }

  const student = await prisma.student.update({ where: { id }, data: { status: "active" } });

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
