"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatWIB } from "@/lib/utils/datetime";

type SessionRow = {
  id: string;
  userId: string;
  email: string;
  role: "siswa" | "admin_sekolah" | "admin_pusat";
  nama: string | null;
  ip: string | null;
  device: string | null;
  loginAt: string;
};

const ROLE_LABEL: Record<SessionRow["role"], string> = {
  siswa: "Siswa",
  admin_sekolah: "Admin Sekolah",
  admin_pusat: "Admin Pusat",
};

export default function SesiAktifPage() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/sesi");
      const data = await res.json().catch(() => null);
      if (!ignore) {
        if (res.ok) {
          setSessions(data.sessions ?? []);
          setError(null);
        } else {
          setError(data?.error ?? "Gagal memuat daftar sesi.");
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  async function handleForceLogout(row: SessionRow) {
    const label = row.nama ?? row.email;
    if (
      !window.confirm(
        `Paksa logout ${label} (${ROLE_LABEL[row.role]})? Akun ini akan langsung keluar dari semua perangkat, dan tidak bisa login lagi selama beberapa menit.`,
      )
    ) {
      return;
    }
    setProcessingId(row.id);
    const res = await fetch(`/api/admin-pusat/sesi/${row.id}/force-logout`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setProcessingId(null);
    if (!res.ok) {
      alert(data?.error ?? "Gagal memutus sesi.");
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Sesi Aktif</h1>
        <p className="text-sm text-slate-500">
          Akun yang belum tercatat logout sejak login terakhirnya. Cek waktu login untuk menilai
          kewajaran — bukan jaminan sesinya masih dipakai detik ini.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!error && sessions !== null && sessions.length === 0 && (
        <EmptyState title="Tidak ada sesi aktif" description="Belum ada yang login." />
      )}

      {sessions !== null && sessions.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Pengguna</th>
                <th className="px-4 py-2 font-medium">Peran</th>
                <th className="px-4 py-2 font-medium">Login sejak</th>
                <th className="px-4 py-2 font-medium">IP</th>
                <th className="px-4 py-2 font-medium">Perangkat</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-900">{row.nama ?? row.email}</div>
                    {row.nama && <div className="text-xs text-slate-400">{row.email}</div>}
                  </td>
                  <td className="px-4 py-2">{ROLE_LABEL[row.role]}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                    {formatWIB(row.loginAt)}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{row.ip ?? "—"}</td>
                  <td className="max-w-xs truncate px-4 py-2 text-xs text-slate-500">
                    {row.device ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleForceLogout(row)}
                      disabled={processingId === row.id}
                      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                    >
                      {processingId === row.id ? "Memproses..." : "Paksa logout"}
                    </button>
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
