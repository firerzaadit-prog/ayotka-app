import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { getRemainingSeconds, isExpired } from "@/lib/exam/timing";
import { finalizeAttempt } from "@/lib/exam/finalize";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Tiket 4.9 (Bagian 3.2 brief): admin sekolah pause sesi siswa Jalur A yang
 * terputus. sisa_detik dibekukan ke nilai sisa sungguhan saat ini (bukan
 * diset ulang) - mulai_at TIDAK diubah di sini supaya perhitungan
 * "berapa detik sudah lewat sejak pause" tetap akurat kalau suatu saat
 * dibutuhkan; deadline baru dihitung ulang dari titik ini lewat mulai_at
 * yang direset saat resume (lihat route resume).
 */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_sekolah", "admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const { id } = await params;
  const attempt = await prisma.attempt.findUnique({
    where: { id },
    include: { student: true },
  });
  if (!attempt || attempt.student.schoolId !== schoolId) {
    return NextResponse.json({ error: "Attempt tidak ditemukan." }, { status: 404 });
  }
  if (attempt.status !== "berjalan") {
    return NextResponse.json({ error: "Attempt ini tidak sedang berjalan." }, { status: 409 });
  }

  if (isExpired(attempt)) {
    await finalizeAttempt(null, attempt.id, "kedaluwarsa");
    return NextResponse.json(
      { error: "Waktu attempt ini sudah habis sebelum sempat dijeda." },
      { status: 409 },
    );
  }

  const updated = await prisma.attempt.update({
    where: { id },
    data: { status: "paused", sisaDetik: getRemainingSeconds(attempt) },
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "attempts",
    entitasId: id,
    before: attempt,
    after: updated,
    ip: getClientIp(request),
  });

  return NextResponse.json({ attempt: updated });
}
