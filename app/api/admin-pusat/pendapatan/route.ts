import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { periodeBulanWIB } from "@/lib/utils/datetime";

/**
 * Dashboard pendapatan — dihitung dari Invoice (Jalur A, siswa individu)
 * berstatus paid. Total dihitung langsung dari SUM(amount) lewat aggregate
 * DB, bukan dijumlah manual di kode (Tiket 6.10).
 *
 * Jalur B (sekolah) dan C (mitra/voucher) sengaja TIDAK masuk di sini -
 * keduanya tidak pernah membuat baris invoices (Bagian 4 dokumen rencana).
 * Nilai kontrak sekolah dan penjualan voucher batch terjadi di luar sistem
 * inti, dicatat manual oleh tim AyoTKA.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const [agg, transaksi] = await Promise.all([
    prisma.invoice.aggregate({
      where: { status: "paid" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.invoice.findMany({
      where: { status: "paid" },
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { nama: true } },
        plan: { select: { nama: true } },
      },
    }),
  ]);

  const periodeIni = periodeBulanWIB();
  const pendapatanBulanIni = transaksi
    .filter((i) => periodeBulanWIB(i.createdAt) === periodeIni)
    .reduce((sum, i) => sum + i.amount, 0);

  const trenMap = new Map<string, number>();
  for (const i of transaksi) {
    const periode = periodeBulanWIB(i.createdAt);
    trenMap.set(periode, (trenMap.get(periode) ?? 0) + i.amount);
  }
  const tren = Array.from(trenMap.entries())
    .map(([periode, totalPendapatan]) => ({ periode, totalPendapatan }))
    .sort((a, b) => a.periode.localeCompare(b.periode))
    .slice(-12);

  return NextResponse.json({
    totalPendapatan: agg._sum.amount ?? 0,
    totalTransaksi: agg._count,
    pendapatanBulanIni,
    tren,
    transaksi: transaksi.map((i) => ({
      id: i.id,
      jumlah: i.amount,
      siswaNama: i.student.nama,
      paket: i.plan.nama,
      dibayarAt: i.createdAt,
    })),
  });
}
