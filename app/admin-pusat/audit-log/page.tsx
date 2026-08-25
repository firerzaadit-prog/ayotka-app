"use client";

import { Fragment, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/input";
import { formatWIB } from "@/lib/utils/datetime";

type AdminOption = { userId: string; email: string; schoolNama: string };
type AuditLogRow = {
  id: string;
  createdAt: string;
  aksi: string;
  entitas: string;
  entitasId: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  user: { email: string; role: string } | null;
};

const AKSI_LABEL: Record<string, string> = { create: "Buat", update: "Ubah", delete: "Hapus" };

export default function AuditLogPage() {
  const [options, setOptions] = useState<AdminOption[]>([]);
  const [userId, setUserId] = useState("");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [aksi, setAksi] = useState("");
  const [logs, setLogs] = useState<AuditLogRow[] | null>(null);
  const [capped, setCapped] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/audit-log/admin-sekolah-options");
      const data = await res.json().catch(() => null);
      if (!ignore) setOptions(data?.options ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const qs = new URLSearchParams();
      if (userId) qs.set("userId", userId);
      if (dari) qs.set("dari", dari);
      if (sampai) qs.set("sampai", sampai);
      if (aksi) qs.set("aksi", aksi);
      const res = await fetch(`/api/admin-pusat/audit-log?${qs.toString()}`);
      const data = await res.json().catch(() => null);
      if (!ignore) {
        if (res.ok) {
          setLogs(data.logs ?? []);
          setCapped(Boolean(data.capped));
          setError(null);
        } else {
          setError(data?.error ?? "Gagal memuat audit log.");
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [userId, dari, sampai, aksi]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Audit Trail</h1>
        <p className="text-sm text-slate-500">
          Riwayat siapa membuat/mengubah/menghapus data, kapan, dan nilai sebelum-sesudahnya.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <Label htmlFor="filterAdmin">Admin sekolah</Label>
          <select
            id="filterAdmin"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Semua pengguna</option>
            {options.map((o) => (
              <option key={o.userId} value={o.userId}>
                {o.schoolNama} — {o.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="filterDari">Dari tanggal</Label>
          <input
            id="filterDari"
            type="date"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={dari}
            onChange={(e) => setDari(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="filterSampai">Sampai tanggal</Label>
          <input
            id="filterSampai"
            type="date"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={sampai}
            onChange={(e) => setSampai(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="filterAksi">Jenis aksi</Label>
          <select
            id="filterAksi"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={aksi}
            onChange={(e) => setAksi(e.target.value)}
          >
            <option value="">Semua aksi</option>
            <option value="create">Buat</option>
            <option value="update">Ubah</option>
            <option value="delete">Hapus</option>
          </select>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!error && logs !== null && logs.length === 0 && (
        <EmptyState
          title="Tidak ada aktivitas"
          description="Tidak ada catatan audit log yang cocok dengan filter ini."
        />
      )}

      {logs !== null && logs.length > 0 && (
        <>
          {capped && (
            <p className="text-xs text-amber-700">
              Menampilkan {logs.length} catatan terbaru yang cocok — persempit filter untuk hasil
              lebih spesifik kalau ada yang lebih lama tidak terlihat.
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Waktu</th>
                  <th className="px-4 py-2 font-medium">Pengguna</th>
                  <th className="px-4 py-2 font-medium">Aksi</th>
                  <th className="px-4 py-2 font-medium">Entitas</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr className="border-b border-slate-100 last:border-0">
                      <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                        {formatWIB(log.createdAt)}
                      </td>
                      <td className="px-4 py-2">{log.user?.email ?? "(akun terhapus)"}</td>
                      <td className="px-4 py-2">{AKSI_LABEL[log.aksi] ?? log.aksi}</td>
                      <td className="px-4 py-2">
                        {log.entitas}
                        {log.entitasId && (
                          <span className="ml-1 font-mono text-xs text-slate-400">
                            {log.entitasId}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-sm font-medium text-slate-600 hover:text-slate-900"
                        >
                          {expandedId === log.id ? "Sembunyikan" : "Detail"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr className="border-b border-slate-100 bg-slate-50 last:border-0">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                              <p className="mb-1 text-xs font-medium text-slate-500">Sebelum</p>
                              <pre className="overflow-x-auto rounded-md bg-white p-2 text-xs text-slate-700">
                                {log.beforeJson ? JSON.stringify(log.beforeJson, null, 2) : "—"}
                              </pre>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-medium text-slate-500">Sesudah</p>
                              <pre className="overflow-x-auto rounded-md bg-white p-2 text-xs text-slate-700">
                                {log.afterJson ? JSON.stringify(log.afterJson, null, 2) : "—"}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
