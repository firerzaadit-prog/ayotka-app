"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { formatWIBDate } from "@/lib/utils/datetime";

type Transaksi = {
  id: string;
  jumlah: number;
  disetujuiAt: string | null;
  createdAt: string;
  user: { email: string };
  plan: { nama: string };
};

type Pendapatan = {
  totalPendapatan: number;
  totalTransaksi: number;
  pendapatanBulanIni: number;
  transaksi: Transaksi[];
};

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
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
    return <p className="text-sm text-slate-500">Memuat...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pendapatan" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total pendapatan (semua waktu)" value={formatRupiah(data.totalPendapatan)} />
        <StatCard label="Pendapatan bulan ini" value={formatRupiah(data.pendapatanBulanIni)} />
        <StatCard label="Total transaksi disetujui" value={data.totalTransaksi} />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Daftar Transaksi</h2>
        {data.transaksi.length === 0 ? (
          <EmptyState title="Belum ada transaksi" description="Belum ada order yang disetujui." />
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
                    <Td>{t.user.email}</Td>
                    <Td>{t.plan.nama}</Td>
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
