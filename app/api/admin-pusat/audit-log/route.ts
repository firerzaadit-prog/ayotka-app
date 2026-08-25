import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { startOfDayWIB } from "@/lib/utils/datetime";

const MAX_ROWS = 200;
const AKSI_VALUES = ["create", "update", "delete"] as const;

/**
 * Tiket 7.3 (Bagian 5 brief, "Audit Trail Admin Sekolah"): admin pusat lihat
 * siapa membuat/mengubah/menghapus soal & data siswa, kapan, dan nilai
 * sebelum-sesudahnya. Sumber datanya audit_logs yang sudah ditulis sejak
 * Tiket 1.7 di setiap route create/update/delete - halaman ini murni
 * baca+filter, tidak ada tulisan baru.
 */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const dari = url.searchParams.get("dari");
  const sampai = url.searchParams.get("sampai");
  const aksi = url.searchParams.get("aksi");

  const createdAtFilter: { gte?: Date; lt?: Date } = {};
  if (dari) createdAtFilter.gte = startOfDayWIB(dari);
  if (sampai) createdAtFilter.lt = new Date(startOfDayWIB(sampai).getTime() + 24 * 60 * 60 * 1000);

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(userId ? { userId } : {}),
      ...(Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}),
      ...(aksi && (AKSI_VALUES as readonly string[]).includes(aksi) ? { aksi } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    include: { user: { select: { email: true, role: true } } },
  });

  return NextResponse.json({ logs, capped: logs.length === MAX_ROWS });
}
