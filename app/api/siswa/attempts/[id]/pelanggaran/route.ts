import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { loadOwnedAttempt } from "@/lib/exam/attempt-access";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Tiket 4.13: catat deteksi pindah tab ke server (sebelumnya cuma di
 * state React, hilang tiap refresh & tidak terlihat admin) - dipanggil
 * fire-and-forget dari client tiap kali visibilitychange ke "hidden"
 * terdeteksi selama attempt berjalan.
 */
export async function POST(_request: Request, { params }: RouteParams) {
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
  if (attempt.status !== "berjalan") {
    return NextResponse.json({ tabSwitchCount: attempt.tabSwitchCount });
  }

  const updated = await prisma.attempt.update({
    where: { id },
    data: { tabSwitchCount: { increment: 1 } },
    select: { tabSwitchCount: true },
  });

  return NextResponse.json({ tabSwitchCount: updated.tabSwitchCount });
}
