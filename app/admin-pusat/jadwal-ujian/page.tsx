"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { formatWIB } from "@/lib/utils/datetime";

type AssignmentRow = {
  id: string;
  sekolahNama: string;
  paketNama: string;
  kelas: string;
  mulai: string;
  selesai: string;
  metodeDistribusi: "otomatis" | "manual";
  isActive: boolean;
  jumlahAttempt: number;
};

const METODE_LABEL: Record<string, string> = { otomatis: "Otomatis (bergilir)", manual: "Manual" };

export default function JadwalUjianPage() {
  const [assignments, setAssignments] = useState<AssignmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/jadwal-ujian");
      const data = await res.json().catch(() => null);
      if (!ignore) {
        if (res.ok) setAssignments(data.assignments ?? []);
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
        <h1 className="text-xl font-semibold text-slate-900">Jadwal Ujian</h1>
        <p className="text-sm text-slate-500">
          Semua penugasan ujian (jendela waktu, paket, rombel) dari seluruh sekolah, hanya untuk
          dipantau - buat/ubah penugasan tetap dilakukan admin sekolah masing-masing.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {assignments === null && !error && <p className="text-sm text-slate-500">Memuat...</p>}
      {assignments?.length === 0 && (
        <EmptyState
          title="Belum ada penugasan ujian"
          description="Belum ada sekolah yang membuat penugasan ujian."
        />
      )}

      {assignments && assignments.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Sekolah</th>
                <th className="px-4 py-2 font-medium">Paket</th>
                <th className="px-4 py-2 font-medium">Rombel</th>
                <th className="px-4 py-2 font-medium">Jendela waktu</th>
                <th className="px-4 py-2 font-medium">Distribusi</th>
                <th className="px-4 py-2 font-medium">Attempt</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-900">{a.sekolahNama}</td>
                  <td className="px-4 py-2">
                    <Link href={`/admin-pusat/jadwal-ujian/${a.id}`} className="text-slate-900 hover:underline">
                      {a.paketNama}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{a.kelas}</td>
                  <td className="px-4 py-2 text-xs">
                    {formatWIB(a.mulai)} — {formatWIB(a.selesai)}
                  </td>
                  <td className="px-4 py-2">{METODE_LABEL[a.metodeDistribusi]}</td>
                  <td className="px-4 py-2">{a.jumlahAttempt}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        a.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {a.isActive ? "Aktif" : "Nonaktif"}
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
