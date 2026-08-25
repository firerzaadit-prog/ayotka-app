"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
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
      <PageHeader
        title="Sesi Aktif"
        description="Akun yang belum tercatat logout sejak login terakhirnya. Cek waktu login untuk menilai kewajaran — bukan jaminan sesinya masih dipakai detik ini."
      />

      {error && <Alert variant="danger">{error}</Alert>}

      {!error && sessions !== null && sessions.length === 0 && (
        <EmptyState title="Tidak ada sesi aktif" description="Belum ada yang login." />
      )}

      {sessions !== null && sessions.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Pengguna</Th>
                <Th>Peran</Th>
                <Th>Login sejak</Th>
                <Th>IP</Th>
                <Th>Perangkat</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <tbody>
              {sessions.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <div className="font-medium text-slate-900">{row.nama ?? row.email}</div>
                    {row.nama && <div className="text-xs text-slate-400">{row.email}</div>}
                  </Td>
                  <Td>{ROLE_LABEL[row.role]}</Td>
                  <Td className="whitespace-nowrap text-slate-500">
                    {formatWIB(row.loginAt)}
                  </Td>
                  <Td className="font-mono text-xs">{row.ip ?? "—"}</Td>
                  <Td className="max-w-xs truncate text-xs text-slate-500">
                    {row.device ?? "—"}
                  </Td>
                  <Td className="text-right">
                    <button
                      onClick={() => handleForceLogout(row)}
                      disabled={processingId === row.id}
                      className="text-sm font-medium text-rose-600 hover:underline disabled:opacity-50"
                    >
                      {processingId === row.id ? "Memproses..." : "Paksa logout"}
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
