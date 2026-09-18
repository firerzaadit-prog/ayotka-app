"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { TrendChart } from "@/components/ui/trend-chart";
import { PageSkeleton } from "@/components/ui/skeleton";
import { IconWallet } from "@/components/ui/empty-state-icons";
import { formatWIBDate, labelPeriodeBulan } from "@/lib/utils/datetime";
import { useDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type Transaksi = {
  id: string;
  jumlah: number;
  dibayarAt: string;
  siswaNama: string;
  paket: string;
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
  const { confirm } = useDialog();
  const toast = useToast();
  const [data, setData] = useState<Pendapatan | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refundingId, setRefundingId] = useState<string | null>(null);

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
  }, [refreshKey]);

  async function handleRefund(t: Transaksi) {
    const ok = await confirm({
      title: `Refund pembayaran ${t.siswaNama}?`,
      description: "Invoice akan ditandai refunded dan akses try out siswa ini dicabut.",
      danger: true,
    });
    if (!ok) return;

    setRefundingId(t.id);
    let res = await fetch(`/api/admin-pusat/invoices/${t.id}/refund`, { method: "POST" });
    let json = await res.json().catch(() => null);

    if (res.ok && json?.requiresConfirmation) {
      const proceed = await confirm({
        title: "Siswa sudah memakai akses ini",
        description: json.message,
        danger: true,
      });
      if (!proceed) {
        setRefundingId(null);
        return;
      }
      res = await fetch(`/api/admin-pusat/invoices/${t.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      json = await res.json().catch(() => null);
    }

    setRefundingId(null);
    if (!res.ok) {
      toast.error(json?.error ?? "Gagal memproses refund.");
      return;
    }
    toast.success("Refund berhasil diproses.");
    setRefreshKey((k) => k + 1);
  }

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
          <EmptyState icon={<IconWallet />} title="Belum ada transaksi" description="Belum ada invoice yang dibayar." />
        ) : (() => {
          const totalPages = Math.max(1, Math.ceil(data.transaksi.length / pageSize));
          const pageRows = data.transaksi.slice((page - 1) * pageSize, page * pageSize);
          return (
            <div className="flex flex-col gap-3">
              <TableContainer>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Tanggal dibayar</Th>
                      <Th>Siswa</Th>
                      <Th>Paket</Th>
                      <Th>Jumlah</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <tbody>
                    {pageRows.map((t) => (
                      <Tr key={t.id}>
                        <Td>{formatWIBDate(t.dibayarAt)}</Td>
                        <Td>{t.siswaNama}</Td>
                        <Td>{t.paket}</Td>
                        <Td>{formatRupiah(t.jumlah)}</Td>
                        <Td className="text-right">
                          <button
                            onClick={() => handleRefund(t)}
                            disabled={refundingId === t.id}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                          >
                            {refundingId === t.id ? "Memproses..." : "Refund"}
                          </button>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={data.transaksi.length}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </div>
          );
        })()}
      </section>
    </div>
  );
}
