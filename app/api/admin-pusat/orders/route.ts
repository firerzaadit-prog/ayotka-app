import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { OrderStatus } from "@prisma/client";

const VALID_STATUS: readonly string[] = ["menunggu_verifikasi", "disetujui", "ditolak", "kedaluwarsa"];

/** Tiket 6.4: antrean approval bukti transfer siswa mandiri. */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const status = new URL(request.url).searchParams.get("status");
  const where = status && VALID_STATUS.includes(status) ? { status: status as OrderStatus } : {};

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true } },
      plan: { select: { nama: true, durasiHari: true } },
    },
  });

  return NextResponse.json({ orders });
}
