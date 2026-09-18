import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IconWallet } from "@/components/ui/empty-state-icons";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { formatWIBDate, formatWIB } from "@/lib/utils/datetime";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/**
 * Jalur C (mitra/reseller, Bagian 5 & 6.5 dokumen rencana): dashboard
 * mitra untuk memantau kode voucher yang dibeli, membagikannya ke siswa,
 * dan melihat skema diskon grosir aktif.
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

  const [vouchers, commissions, tiers] = await Promise.all([
    prisma.voucher.findMany({
      where: { partnerId: partner.id },
      include: { plan: { select: { nama: true, kode: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.partnerCommission.findMany({
      where: { partnerId: partner.id },
      include: { school: { select: { nama: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.voucherPriceTier.findMany({
      orderBy: { minJumlah: "asc" },
    }),
  ]);

  const totalVoucher = vouchers.length;
  const totalTerpakai = vouchers.filter((v) => v.status === "used").length;
  const totalTersedia = vouchers.filter((v) => v.status === "unused").length;

  const byPlan = new Map<string, { nama: string; total: number; terpakai: number }>();
  for (const v of vouchers) {
    const entry = byPlan.get(v.plan.nama) ?? { nama: v.plan.nama, total: 0, terpakai: 0 };
    entry.total += 1;
    if (v.status === "used") entry.terpakai += 1;
    byPlan.set(v.plan.nama, entry);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Dashboard Mitra — ${partner.nama}`}
        description="Beli voucher secara mandiri dengan diskon grosir, bagikan kode akses ke siswa, dan pantau penggunaannya."
      />

      {/* Ringkasan Statistik */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total voucher" value={totalVoucher} />
        <StatCard label="Siap dibagikan" value={totalTersedia} />
        <StatCard label="Sudah terpakai" value={totalTerpakai} />
        <StatCard label="Kode referral" value={partner.referralCode} />
      </div>

      {/* Skema Diskon Grosir Mitra Aktif */}
      <section className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/40 p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Skema Diskon Grosir Mitra</h2>
            <p className="text-xs text-slate-500">
              Dapatkan potongan harga langsung saat membeli voucher dalam jumlah tertentu. Berlaku untuk Paket Bulanan dan Paket Semester.
            </p>
          </div>
          <Link href="/mitra/beli-voucher" className={buttonClassName("primary")}>
            Beli Voucher Sekarang
          </Link>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tiers.length === 0 ? (
            <div className="col-span-3 text-xs text-slate-500">Tier diskon dikelola oleh admin pusat.</div>
          ) : (
            tiers.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-indigo-200/70 bg-white p-3.5 shadow-xs">
                <div>
                  <p className="text-xs font-semibold text-slate-700">{t.label}</p>
                  <p className="text-[0.7rem] text-slate-400">Minimal {t.minJumlah} voucher</p>
                </div>
                <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-sm font-bold text-emerald-800">
                  Hemat {t.diskonPersen}%
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Voucher per Paket */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Distribusi per Paket</h2>
        {byPlan.size === 0 ? (
          <EmptyState
            icon={<IconWallet />}
            title="Belum ada voucher yang dibeli"
            description="Beli voucher langsung secara online untuk mendapatkan kode akses bagi siswa."
            action={
              <Link href="/mitra/beli-voucher" className={buttonClassName("primary")}>
                Beli Voucher
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from(byPlan.values()).map((p) => (
              <Card key={p.nama} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{p.nama}</p>
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    {p.total - p.terpakai} tersedia
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {p.terpakai} dari {p.total} voucher telah diaktifkan oleh siswa
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-indigo-600 transition-all"
                    style={{ width: `${p.total > 0 ? (p.terpakai / p.total) * 100 : 0}%` }}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Daftar Kode Akses Voucher yang Bisa Dibagikan */}
      {vouchers.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Daftar Kode Akses Siswa</h2>
              <p className="text-xs text-slate-500">
                Bagikan kode akses ini kepada siswa untuk diaktivasi di menu Langganan akun siswa mereka.
              </p>
            </div>
            <span className="text-xs text-slate-400">Total {vouchers.length} kode</span>
          </div>

          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Kode Akses</Th>
                  <Th>Paket</Th>
                  <Th>Status</Th>
                  <Th>Tanggal Beli</Th>
                  <Th>Status Pemakaian</Th>
                </Tr>
              </Thead>
              <tbody>
                {vouchers.map((v) => (
                  <Tr key={v.id}>
                    <Td>
                      <span className="font-mono text-sm font-bold tracking-wider text-indigo-700 bg-indigo-50/70 border border-indigo-200/60 rounded px-2 py-0.5 select-all">
                        {v.code}
                      </span>
                    </Td>
                    <Td className="font-medium text-slate-900">{v.plan.nama}</Td>
                    <Td>
                      <Badge variant={v.status === "unused" ? "success" : v.status === "used" ? "neutral" : "warning"}>
                        {v.status === "unused" ? "Tersedia" : v.status === "used" ? "Sudah Dipakai" : "Kedaluwarsa"}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-slate-500">{formatWIBDate(v.createdAt)}</Td>
                    <Td className="text-xs text-slate-500">
                      {v.usedAt ? `Digunakan ${formatWIB(v.usedAt)}` : "Belum diaktivasi"}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        </section>
      )}

      {/* Komisi Rujukan Sekolah jika ada */}
      {commissions.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-900">Komisi Rujukan Sekolah</h2>
          <div className="flex flex-col gap-2">
            {commissions.map((c) => (
              <Card key={c.id} className="flex items-center justify-between p-4">
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
