import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Tiket 4.9: lanjutkan attempt yang dijeda. mulai_at direset ke waktu
 * resume ini - dikombinasikan dengan sisa_detik yang sudah dibekukan saat
 * pause, deadline (mulai_at + sisa_detik) otomatis jadi "sisa waktu yang
 * wajar dari sekarang", persis kriteria selesai tiket 4.9, tanpa perlu
 * kolom "total waktu terpakai" terpisah.
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
  if (attempt.status !== "paused") {
    return NextResponse.json({ error: "Attempt ini tidak sedang dijeda." }, { status: 409 });
  }

  const updated = await prisma.attempt.update({
    where: { id },
    data: { status: "berjalan", mulaiAt: new Date() },
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
