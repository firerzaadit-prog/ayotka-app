"use client";

import { Fragment, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
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

const selectClassName =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

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
      <PageHeader
        title="Audit Trail"
        description="Riwayat siapa membuat/mengubah/menghapus data, kapan, dan nilai sebelum-sesudahnya."
      />

      <div className="flex flex-wrap gap-4">
        <div>
          <Label htmlFor="filterAdmin">Admin sekolah</Label>
          <select
            id="filterAdmin"
            className={selectClassName}
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
          <Input
            id="filterDari"
            type="date"
            className="w-40"
            value={dari}
            onChange={(e) => setDari(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="filterSampai">Sampai tanggal</Label>
          <Input
            id="filterSampai"
            type="date"
            className="w-40"
            value={sampai}
            onChange={(e) => setSampai(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="filterAksi">Jenis aksi</Label>
          <select
            id="filterAksi"
            className={selectClassName}
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

      {error && <Alert variant="danger">{error}</Alert>}

      {!error && logs !== null && logs.length === 0 && (
        <EmptyState
          title="Tidak ada aktivitas"
          description="Tidak ada catatan audit log yang cocok dengan filter ini."
        />
      )}

      {logs !== null && logs.length > 0 && (
        <>
          {capped && (
            <Alert variant="warning">
              Menampilkan {logs.length} catatan terbaru yang cocok — persempit filter untuk hasil
              lebih spesifik kalau ada yang lebih lama tidak terlihat.
            </Alert>
          )}
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Waktu</Th>
                  <Th>Pengguna</Th>
                  <Th>Aksi</Th>
                  <Th>Entitas</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <tbody>
                {logs.map((log) => (
                  <Fragment key={log.id}>
                    <Tr>
                      <Td className="whitespace-nowrap text-slate-500">
                        {formatWIB(log.createdAt)}
                      </Td>
                      <Td>{log.user?.email ?? "(akun terhapus)"}</Td>
                      <Td>{AKSI_LABEL[log.aksi] ?? log.aksi}</Td>
                      <Td>
                        {log.entitas}
                        {log.entitasId && (
                          <span className="ml-1 font-mono text-xs text-slate-400">
                            {log.entitasId}
                          </span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-sm font-medium text-slate-600 hover:text-slate-900"
                        >
                          {expandedId === log.id ? "Sembunyikan" : "Detail"}
                        </button>
                      </Td>
                    </Tr>
                    {expandedId === log.id && (
                      <Tr className="bg-slate-50">
                        <Td colSpan={5} className="py-3">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                              <p className="mb-1 text-xs font-medium text-slate-500">Sebelum</p>
                              <pre className="overflow-x-auto rounded-lg bg-white p-2 text-xs text-slate-700">
                                {log.beforeJson ? JSON.stringify(log.beforeJson, null, 2) : "—"}
                              </pre>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-medium text-slate-500">Sesudah</p>
                              <pre className="overflow-x-auto rounded-lg bg-white p-2 text-xs text-slate-700">
                                {log.afterJson ? JSON.stringify(log.afterJson, null, 2) : "—"}
                              </pre>
                            </div>
                          </div>
                        </Td>
                      </Tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        </>
      )}
    </div>
  );
}
