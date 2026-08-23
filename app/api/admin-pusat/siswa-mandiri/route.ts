import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

/** Tiket 3.3: daftar siswa mandiri (Jalur B) yang menunggu aktivasi manual sementara (pengganti Fase 6). */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const students = await prisma.student.findMany({
    where: { jalur: "B", status: "pending", deletedAt: null },
    orderBy: { id: "desc" },
    include: { school: { select: { nama: true, status: true } }, user: { select: { email: true } } },
  });

  return NextResponse.json({ students });
}
