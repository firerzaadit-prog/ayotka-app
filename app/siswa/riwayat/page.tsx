"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { formatWIB } from "@/lib/utils/datetime";

type RiwayatItem = {
  id: string;
  paketNama: string;
  kelas: string | null;
  status: "berjalan" | "paused" | "selesai" | "kedaluwarsa";
  skorAkhir: number | null;
  mulaiAt: string;
  selesaiAt: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  berjalan: "Sedang dikerjakan",
  paused: "Dijeda",
  selesai: "Selesai",
  kedaluwarsa: "Waktu habis",
};

function hrefFor(item: RiwayatItem) {
  return item.status === "berjalan" || item.status === "paused"
    ? `/siswa/attempt/${item.id}`
    : `/siswa/hasil/${item.id}`;
}

/** Tiket 5.6: riwayat semua attempt, tetap bisa dibuka kapan saja. */
export default function RiwayatPage() {
  const [attempts, setAttempts] = useState<RiwayatItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/siswa/attempts");
      const data = await res.json().catch(() => null);
      if (!ignore) {
        if (res.ok) setAttempts(data.attempts ?? []);
        else setError(data?.error ?? "Gagal memuat riwayat.");
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Riwayat Ujian</h1>
        <p className="text-sm text-slate-500">
          Semua ujian yang pernah kamu kerjakan, bisa dibuka kapan saja.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {attempts === null && !error && <p className="text-sm text-slate-500">Memuat...</p>}
      {attempts?.length === 0 && (
        <EmptyState
          title="Belum ada riwayat ujian"
          description="Kerjakan ujian yang ditugaskan sekolahmu atau paket latihan mandiri untuk mulai."
          action={
            <Link
              href="/siswa/ujian"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Buka Ujian
            </Link>
          }
        />
      )}

      {attempts && attempts.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Paket</th>
                <th className="px-4 py-2 font-medium">Kelas</th>
                <th className="px-4 py-2 font-medium">Mulai</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Nilai</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-900">{a.paketNama}</td>
                  <td className="px-4 py-2">{a.kelas ?? "Mandiri"}</td>
                  <td className="px-4 py-2 text-xs">{formatWIB(a.mulaiAt)}</td>
                  <td className="px-4 py-2">{STATUS_LABEL[a.status]}</td>
                  <td className="px-4 py-2">{a.skorAkhir?.toFixed(0) ?? "-"}</td>
                  <td className="px-4 py-2 text-right">
                    <Link href={hrefFor(a)} className="text-sm font-medium text-slate-600 hover:text-slate-900">
                      {a.status === "berjalan" || a.status === "paused" ? "Lanjutkan" : "Lihat hasil"}
                    </Link>
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
