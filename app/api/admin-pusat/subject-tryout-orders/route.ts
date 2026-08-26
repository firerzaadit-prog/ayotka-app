import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { OrderStatus } from "@prisma/client";

const VALID_STATUS: readonly string[] = ["menunggu_verifikasi", "disetujui", "ditolak", "kedaluwarsa"];

/** Bagian 7.3 brief: antrean approval order paket try out per mapel. */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const status = new URL(request.url).searchParams.get("status");
  const where = status && VALID_STATUS.includes(status) ? { status: status as OrderStatus } : {};

  const orders = await prisma.subjectTryOutOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true } },
      items: { include: { subject: { select: { nama: true } } } },
    },
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      jumlah: o.jumlah,
      status: o.status,
      catatanAdmin: o.catatanAdmin,
      createdAt: o.createdAt,
      user: o.user,
      mapel: o.items.map((i) => i.subject.nama),
    })),
  });
}
