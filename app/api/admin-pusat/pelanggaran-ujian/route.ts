import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

/**
 * Tiket 4.13: pantauan lintas sekolah untuk admin pusat - attempt mana saja
 * yang tercatat pindah tab, supaya tidak perlu buka tiap penugasan admin
 * sekolah satu-satu.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const attempts = await prisma.attempt.findMany({
    where: { tabSwitchCount: { gt: 0 } },
    orderBy: { tabSwitchCount: "desc" },
    take: 200,
    include: {
      student: { select: { nama: true, school: { select: { nama: true } } } },
      package: { select: { nama: true } },
    },
  });

  return NextResponse.json({
    attempts: attempts.map((a) => ({
      id: a.id,
      studentNama: a.student.nama,
      sekolahNama: a.student.school?.nama ?? "-",
      paketNama: a.package.nama,
      status: a.status,
      tabSwitchCount: a.tabSwitchCount,
      mulaiAt: a.mulaiAt,
    })),
  });
}
