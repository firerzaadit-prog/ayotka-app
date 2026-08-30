"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { TrendChart } from "@/components/ui/trend-chart";
import { PageSkeleton } from "@/components/ui/skeleton";
import { IconWallet } from "@/components/ui/empty-state-icons";
import { formatWIBDate, labelPeriodeBulan } from "@/lib/utils/datetime";

type Transaksi = {
  id: string;
  jumlah: number;
  disetujuiAt: string | null;
  userEmail: string;
  paket: string;
  mapel: string[];
};

type Tren = { periode: string; totalPendapatan: number };

type Pendapatan = {
  totalPendapatan: number;
  totalTransaksi: number;
  pendapatanBulanIni: number;
  tren: Tren[];
  transaksi: Transaksi[];
};

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function formatRupiahRingkas(n: number): string {
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}jt`;
  if (n >= 1_000) return `Rp${(n / 1_000).toFixed(0)}rb`;
  return formatRupiah(n);
}

/** Tiket 6.10: dashboard pendapatan - total = SUM(jumlah) order disetujui, dihitung server (aggregate DB). */
export default function PendapatanPage() {
  const [data, setData] = useState<Pendapatan | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/pendapatan");
      const json = await res.json().catch(() => null);
      if (!ignore && res.ok) setData(json);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  if (!data) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pendapatan" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total pendapatan (semua waktu)" value={formatRupiah(data.totalPendapatan)} />
        <StatCard label="Pendapatan bulan ini" value={formatRupiah(data.pendapatanBulanIni)} />
        <StatCard label="Total transaksi disetujui" value={data.totalTransaksi} />
      </div>

      {data.tren.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <p className="mb-3 text-sm font-medium text-slate-700">Tren Pendapatan Bulanan</p>
          <TrendChart
            data={data.tren.map((t) => ({ label: labelPeriodeBulan(t.periode), value: t.totalPendapatan }))}
            variant="bar"
            color="#10b981"
            valueFormatter={formatRupiahRingkas}
          />
        </div>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Daftar Transaksi</h2>
        {data.transaksi.length === 0 ? (
          <EmptyState icon={<IconWallet />} title="Belum ada transaksi" description="Belum ada order yang disetujui." />
        ) : (
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Tanggal disetujui</Th>
                  <Th>Siswa</Th>
                  <Th>Paket</Th>
                  <Th>Jumlah</Th>
                </Tr>
              </Thead>
              <tbody>
                {data.transaksi.map((t) => (
                  <Tr key={t.id}>
                    <Td>{t.disetujuiAt ? formatWIBDate(t.disetujuiAt) : "-"}</Td>
                    <Td>{t.userEmail}</Td>
                    <Td>
                      {t.paket}
                      {t.mapel.length > 0 && (
                        <span className="text-slate-400"> — {t.mapel.join(", ")}</span>
                      )}
                    </Td>
                    <Td>{formatRupiah(t.jumlah)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        )}
      </section>
    </div>
  );
}
