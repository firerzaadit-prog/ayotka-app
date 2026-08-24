import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { effectiveSubscriptionStatus } from "@/lib/billing/subscription-status";

/** Tiket 6.3: status langganan siswa mandiri untuk halaman checkout - jalur A tidak punya langganan pribadi. */
export async function GET() {
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

  if (student.jalur !== "B") {
    return NextResponse.json({ jalur: "A" as const });
  }

  const latest = await prisma.subscription.findFirst({
    where: { userId: user.id, status: { not: "batal" } },
    orderBy: { berakhirAt: "desc" },
    include: { plan: { select: { nama: true } } },
  });

  return NextResponse.json({
    jalur: "B" as const,
    subscription: latest
      ? {
          planNama: latest.plan.nama,
          berakhirAt: latest.berakhirAt,
          status: effectiveSubscriptionStatus(latest),
        }
      : null,
  });
}
