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

  const invoices = await prisma.schoolInvoice.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    include: {
      periode: { select: { nama: true, mulai: true, berakhir: true } },
    },
  });

  return NextResponse.json({ invoices });
}
