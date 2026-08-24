import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { periodeBulanWIB } from "@/lib/utils/datetime";

/**
 * Tiket 6.10: dashboard pendapatan - total dihitung langsung dari
 * SUM(jumlah) order berstatus disetujui lewat aggregate DB (bukan
 * dijumlah manual di kode), supaya kriteria selesai tiket ini ("angka
 * pendapatan di dashboard cocok dengan jumlah order disetujui di
 * database") otomatis terjamin oleh sumbernya sendiri.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const [agg, transaksi] = await Promise.all([
    prisma.order.aggregate({ where: { status: "disetujui" }, _sum: { jumlah: true }, _count: true }),
    prisma.order.findMany({
      where: { status: "disetujui" },
      orderBy: { disetujuiAt: "desc" },
      include: { user: { select: { email: true } }, plan: { select: { nama: true } } },
    }),
  ]);

  const periodeIni = periodeBulanWIB();
  const pendapatanBulanIni = transaksi
    .filter((o) => o.disetujuiAt && periodeBulanWIB(o.disetujuiAt) === periodeIni)
    .reduce((sum, o) => sum + o.jumlah, 0);

  return NextResponse.json({
    totalPendapatan: agg._sum.jumlah ?? 0,
    totalTransaksi: agg._count,
    pendapatanBulanIni,
    transaksi,
  });
}
