import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IconWallet } from "@/components/ui/empty-state-icons";
import { formatWIBDate } from "@/lib/utils/datetime";

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/**
 * Jalur C (mitra/reseller, Bagian 5 & 6.5 dokumen rencana): dashboard
 * read-only jumlah voucher terpakai per batch - TIDAK PERNAH menampilkan
 * NISN/nama siswa yang memakai vouchernya, hanya agregat jumlah.
 */
export default async function MitraDashboardPage() {
  const user = await getCurrentUser();
  const partner = await prisma.partner.findUnique({ where: { userId: user!.id } });

  if (!partner) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Voucher Saya" />
        <EmptyState icon={<IconWallet />} title="Akun mitra belum terhubung" description="Hubungi admin pusat AyoTKA." />
      </div>
    );
  }

  const [vouchers, commissions] = await Promise.all([
    prisma.voucher.findMany({
      where: { partnerId: partner.id },
      include: { plan: { select: { nama: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.partnerCommission.findMany({
      where: { partnerId: partner.id },
      include: { school: { select: { nama: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalVoucher = vouchers.length;
  const totalTerpakai = vouchers.filter((v) => v.status === "used").length;

  const byPlan = new Map<string, { nama: string; total: number; terpakai: number }>();
  for (const v of vouchers) {
    const entry = byPlan.get(v.plan.nama) ?? { nama: v.plan.nama, total: 0, terpakai: 0 };
    entry.total += 1;
    if (v.status === "used") entry.terpakai += 1;
    byPlan.set(v.plan.nama, entry);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={`Voucher — ${partner.nama}`} description="Kode referral kamu tidak menampilkan identitas siswa yang memakainya." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total voucher dibagikan" value={totalVoucher} />
        <StatCard label="Sudah terpakai" value={totalTerpakai} />
        <StatCard label="Kode referral" value={partner.referralCode} />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Voucher per Paket</h2>
        {byPlan.size === 0 ? (
          <EmptyState icon={<IconWallet />} title="Belum ada voucher" description="Hubungi admin pusat untuk membuat batch voucher." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from(byPlan.values()).map((p) => (
              <Card key={p.nama}>
                <p className="font-semibold text-slate-900">{p.nama}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {p.terpakai}/{p.total} terpakai
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {commissions.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-900">Komisi Rujukan Sekolah</h2>
          <div className="flex flex-col gap-2">
            {commissions.map((c) => (
              <Card key={c.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{c.school.nama}</p>
                  <p className="text-xs text-slate-500">
                    {c.amount != null ? formatRupiah(c.amount) : "Menunggu nominal ditetapkan admin"}
                    {c.paidAt && ` · Dibayar ${formatWIBDate(c.paidAt)}`}
                  </p>
                </div>
                <Badge variant={c.status === "paid" ? "success" : "warning"}>
                  {c.status === "paid" ? "Sudah dibayar" : "Menunggu"}
                </Badge>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
