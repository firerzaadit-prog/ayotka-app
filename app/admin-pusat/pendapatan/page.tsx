"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
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
      <h1 className="text-xl font-semibold text-slate-900">Pendapatan</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total pendapatan (semua waktu)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatRupiah(data.totalPendapatan)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Pendapatan bulan ini</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatRupiah(data.pendapatanBulanIni)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total transaksi disetujui</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{data.totalTransaksi}</p>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Daftar Transaksi</h2>
        {data.transaksi.length === 0 ? (
          <EmptyState title="Belum ada transaksi" description="Belum ada order yang disetujui." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Tanggal disetujui</th>
                  <th className="px-4 py-2 font-medium">Siswa</th>
                  <th className="px-4 py-2 font-medium">Paket</th>
                  <th className="px-4 py-2 font-medium">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {data.transaksi.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">{t.disetujuiAt ? formatWIBDate(t.disetujuiAt) : "-"}</td>
                    <td className="px-4 py-2">{t.user.email}</td>
                    <td className="px-4 py-2">{t.plan.nama}</td>
                    <td className="px-4 py-2">{formatRupiah(t.jumlah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
