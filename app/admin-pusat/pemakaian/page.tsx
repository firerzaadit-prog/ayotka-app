"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";

type Counter = {
  id: string;
  jmlAttempt: number;
  jmlAnalisisAi: number;
  user: { email: string; studentProfile: { nama: string; jalur: "A" | "B" } | null };
};

type UsageResponse = { periode: string; counters: Counter[] };

function currentPeriode(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Tiket 6.11 (Bagian 7.1 brief): laporan usage_counters - monitoring pemakaian, BUKAN pembatas otomatis (batas wajar sudah dihapus). */
export default function PemakaianPage() {
  const [periode, setPeriode] = useState(currentPeriode());
  const [data, setData] = useState<UsageResponse | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setData(null);
      const res = await fetch(`/api/admin-pusat/usage-counters?periode=${periode}`);
      const json = await res.json().catch(() => null);
      if (!ignore && res.ok) setData(json);
    })();
    return () => {
      ignore = true;
    };
  }, [periode]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Pemakaian</h1>
        <p className="text-sm text-slate-500">
          Laporan pemakaian attempt & analisis AI per siswa per bulan - untuk memantau biaya,
          bukan pembatas otomatis (tidak ada siswa yang diblokir karena angka di sini).
        </p>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="periode" className="text-sm font-medium text-slate-700">
          Bulan
        </label>
        <input
          id="periode"
          type="month"
          value={periode}
          onChange={(e) => setPeriode(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {!data && <p className="text-sm text-slate-500">Memuat...</p>}
      {data?.counters.length === 0 && (
        <EmptyState title="Belum ada data" description="Belum ada pemakaian tercatat pada bulan ini." />
      )}

      {data && data.counters.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Siswa</th>
                <th className="px-4 py-2 font-medium">Jalur</th>
                <th className="px-4 py-2 font-medium">Jml attempt</th>
                <th className="px-4 py-2 font-medium">Jml analisis AI</th>
              </tr>
            </thead>
            <tbody>
              {data.counters.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{c.user.studentProfile?.nama ?? c.user.email}</td>
                  <td className="px-4 py-2">
                    {c.user.studentProfile?.jalur === "B" ? "Mandiri" : c.user.studentProfile?.jalur === "A" ? "Sekolah" : "-"}
                  </td>
                  <td className="px-4 py-2">{c.jmlAttempt}</td>
                  <td className="px-4 py-2">{c.jmlAnalisisAi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
