import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { getRingkasanAksesUjian } from "@/lib/billing/akses-ujian";

/**
 * Ringkasan akses siswa untuk SATU ujian - dipakai halaman instruksi
 * (app/siswa/(shell)/ujian/mulai): tipe akses (gratis/langganan/sekolah),
 * status jatah ujian gratis, dan saldo/harga/jatah Learning Analytics.
 * Cuma baca; keputusan sesungguhnya tetap gerbang server di POST
 * /api/siswa/attempts.
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const student = await prisma.student.findFirst({ where: { userId: user.id } });
  if (!student) {
    return NextResponse.json({ error: "Profil siswa tidak ditemukan." }, { status: 404 });
  }

  const url = new URL(request.url);
  const packageId = url.searchParams.get("packageId");
  const assignmentId = url.searchParams.get("assignmentId");
  if (!packageId === !assignmentId) {
    return NextResponse.json({ error: "Isi salah satu: packageId atau assignmentId." }, { status: 400 });
  }

  const subjectSelect = { select: { id: true, nama: true } } as const;
  let subject: { id: string; nama: string } | null = null;
  if (packageId) {
    const pkg = await prisma.package.findUnique({ where: { id: packageId }, select: { subject: subjectSelect } });
    subject = pkg?.subject ?? null;
  } else if (assignmentId && student.schoolId) {
    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, schoolId: student.schoolId },
      select: { package: { select: { subject: subjectSelect } } },
    });
    subject = assignment?.package.subject ?? null;
  }
  if (!subject) {
    return NextResponse.json({ error: "Ujian tidak ditemukan." }, { status: 404 });
  }

  const ringkasan = await getRingkasanAksesUjian(student, subject);
  return NextResponse.json(ringkasan, { headers: { "Cache-Control": "no-store" } });
}
