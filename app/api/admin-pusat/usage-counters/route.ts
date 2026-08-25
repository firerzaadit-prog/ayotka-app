import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { periodeBulanWIB } from "@/lib/utils/datetime";

/** Tiket 6.11: laporan pemakaian attempt/analisis AI per pengguna per bulan - monitoring, bukan pembatas. */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const requested = new URL(request.url).searchParams.get("periode");
  const periode = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : periodeBulanWIB();

  const counters = await prisma.usageCounter.findMany({
    where: { periodeBulan: periode },
    include: { user: { select: { email: true, studentProfile: { select: { nama: true, jalur: true } } } } },
    orderBy: [{ jmlAnalisisAi: "desc" }, { jmlAttempt: "desc" }],
  });

  return NextResponse.json({ periode, counters });
}
