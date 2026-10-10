import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";

export async function GET() {
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

  // Prioritas: invoice yang menunggu_pembayaran terlebih dahulu, kalau tidak ada baru ambil invoice terakhir
  const pendingInvoice = await prisma.schoolInvoice.findFirst({
    where: { schoolId, status: "menunggu_pembayaran" },
    orderBy: { createdAt: "desc" },
    include: {
      periode: { select: { nama: true, mulai: true, berakhir: true } },
    },
  });

  const latestInvoice = pendingInvoice ?? (await prisma.schoolInvoice.findFirst({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    include: {
      periode: { select: { nama: true, mulai: true, berakhir: true } },
    },
  }));

  const totalInvoices = await prisma.schoolInvoice.count({
    where: { schoolId },
  });

  return NextResponse.json({
    invoice: latestInvoice,
    totalInvoices,
  });
}
