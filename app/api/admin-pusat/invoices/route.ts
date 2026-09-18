import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

/**
 * Jalur A saja - daftar invoice yang BELUM lunas (pending/expired), untuk
 * jaring pengaman verifikasi manual (lihat [id]/approve/route.ts). Invoice
 * yang sudah paid/refunded tidak perlu tindakan apa pun di sini - lihat
 * halaman Pendapatan untuk transaksi yang sudah lunas.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["pending", "expired"] } },
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { nama: true } },
      plan: { select: { nama: true } },
    },
  });

  return NextResponse.json({
    invoices: invoices.map((i) => ({
      id: i.id,
      siswaNama: i.student.nama,
      paket: i.plan.nama,
      jumlah: i.amount,
      status: i.status,
      dibuatAt: i.createdAt,
      kedaluwarsaAt: i.expiresAt,
    })),
  });
}
