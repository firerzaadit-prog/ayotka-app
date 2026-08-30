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
/**
 * Dashboard pendapatan — dihitung dari SubjectTryOutOrder (paket try out
 * per mapel) yang disetujui. Sejak redesign billing (Bagian 7.3), tidak
 * ada lagi Order berbasis plan/langganan bulanan.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const [agg, transaksi] = await Promise.all([
    prisma.subjectTryOutOrder.aggregate({
      where: { status: "disetujui" },
      _sum: { jumlah: true },
      _count: true,
    }),
    prisma.subjectTryOutOrder.findMany({
      where: { status: "disetujui" },
      orderBy: { disetujuiAt: "desc" },
      include: {
        user: { select: { email: true } },
        servicePackage: { select: { nama: true } },
        items: { include: { subject: { select: { nama: true } } } },
      },
    }),
  ]);

  const periodeIni = periodeBulanWIB();
  const pendapatanBulanIni = transaksi
    .filter((o) => o.disetujuiAt && periodeBulanWIB(o.disetujuiAt) === periodeIni)
    .reduce((sum, o) => sum + o.jumlah, 0);

  const trenMap = new Map<string, number>();
  for (const o of transaksi) {
    if (!o.disetujuiAt) continue;
    const periode = periodeBulanWIB(o.disetujuiAt);
    trenMap.set(periode, (trenMap.get(periode) ?? 0) + o.jumlah);
  }
  const tren = Array.from(trenMap.entries())
    .map(([periode, totalPendapatan]) => ({ periode, totalPendapatan }))
    .sort((a, b) => a.periode.localeCompare(b.periode))
    .slice(-12);

  return NextResponse.json({
    totalPendapatan: agg._sum.jumlah ?? 0,
    totalTransaksi: agg._count,
    pendapatanBulanIni,
    tren,
    transaksi: transaksi.map((o) => ({
      id: o.id,
      jumlah: o.jumlah,
      userEmail: o.user.email,
      paket: o.servicePackage.nama,
      mapel: o.items.map((i) => i.subject.nama),
      disetujuiAt: o.disetujuiAt,
    })),
  });
}
