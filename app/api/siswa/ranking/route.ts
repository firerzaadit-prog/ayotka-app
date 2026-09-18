import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { getLatestRankingForStudent } from "@/lib/exam/ranking";

/**
 * Bagian 8/10 (permintaan user): ranking try out terakhir siswa, dipoll
 * berkala oleh widget dashboard - no-store supaya tidak ada layer cache
 * (CDN/browser) yang menyajikan papan ranking basi selagi peserta lain
 * masih menyelesaikan try out yang sama.
 */
export async function GET() {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const student = await prisma.student.findFirst({ where: { userId: user.id } });
  if (!student) {
    return NextResponse.json(
      { error: "Profil siswa tidak ditemukan." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const latest = await getLatestRankingForStudent(student.id);
  return NextResponse.json({ latest }, { headers: { "Cache-Control": "no-store" } });
}
