"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatWIB } from "@/lib/utils/datetime";

type AttemptRow = {
  id: string;
  studentNama: string;
  sekolahNama: string;
  paketNama: string;
  status: "berjalan" | "paused" | "selesai" | "kedaluwarsa";
  tabSwitchCount: number;
  mulaiAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  berjalan: "Sedang mengerjakan",
  paused: "Dijeda",
  selesai: "Selesai",
  kedaluwarsa: "Waktu habis",
};

export default function PelanggaranUjianPage() {
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/pelanggaran-ujian");
      const data = await res.json().catch(() => null);
      if (!ignore) {
        if (res.ok) setAttempts(data.attempts ?? []);
        else setError(data?.error ?? "Gagal memuat data.");
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Pelanggaran Ujian</h1>
        <p className="text-sm text-slate-500">
          Attempt yang tercatat berpindah tab/aplikasi lain selama mengerjakan ujian, lintas
          semua sekolah (Tiket 4.13).
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {attempts === null && !error && <p className="text-sm text-slate-500">Memuat...</p>}
      {attempts?.length === 0 && (
        <EmptyState
          title="Belum ada pelanggaran tercatat"
          description="Belum ada siswa yang terdeteksi berpindah tab selama ujian berlangsung."
        />
      )}

      {attempts && attempts.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Siswa</th>
                <th className="px-4 py-2 font-medium">Sekolah</th>
                <th className="px-4 py-2 font-medium">Paket</th>
                <th className="px-4 py-2 font-medium">Mulai</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Pindah tab</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-900">{a.studentNama}</td>
                  <td className="px-4 py-2">{a.sekolahNama}</td>
                  <td className="px-4 py-2">{a.paketNama}</td>
                  <td className="px-4 py-2 text-xs">{formatWIB(a.mulaiAt)}</td>
                  <td className="px-4 py-2">{STATUS_LABEL[a.status]}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      {a.tabSwitchCount}x
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
