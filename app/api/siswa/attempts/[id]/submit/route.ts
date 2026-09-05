import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { loadOwnedAttempt, sanitizeAttemptForClient } from "@/lib/exam/attempt-access";
import { finalizeAttempt } from "@/lib/exam/finalize";

type RouteParams = { params: Promise<{ id: string }> };

/** Tiket 4.10: submit manual - skoring otomatis (lihat lib/exam/finalize.ts). */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const attempt = await loadOwnedAttempt(user.id, id);
  if (!attempt) {
    return NextResponse.json({ error: "Attempt tidak ditemukan." }, { status: 404 });
  }

  if (attempt.status === "selesai" || attempt.status === "kedaluwarsa") {
    return NextResponse.json({ attempt: sanitizeAttemptForClient(attempt) });
  }
  if (attempt.status === "paused") {
    return NextResponse.json(
      { error: "Sesi ini sedang dijeda admin sekolah, tidak bisa disubmit." },
      { status: 409 },
    );
  }

  try {
    await finalizeAttempt(null, attempt.id, "selesai");
  } catch (err) {
    console.error(`[submit] finalizeAttempt gagal untuk attempt ${attempt.id}:`, err);
    return NextResponse.json({ error: "Gagal memproses hasil ujian, coba submit lagi." }, { status: 500 });
  }
  const finalAttempt = await prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id } });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "attempts",
    entitasId: attempt.id,
    after: finalAttempt,
    ip: getClientIp(request),
  });

  return NextResponse.json({ attempt: sanitizeAttemptForClient(finalAttempt) });
}
