"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { IconInbox, IconSearch } from "@/components/ui/empty-state-icons";
import { formatWIB } from "@/lib/utils/datetime";
import { useToast } from "@/components/ui/toast";
import { useDialog } from "@/components/ui/dialog";

const PAGE_SIZE = 15;

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
  const toast = useToast();
  const { confirm } = useDialog();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
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
          setPage(1);
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
    const ok = await confirm({
      title: `Paksa logout ${label} (${ROLE_LABEL[row.role]})?`,
      description:
        "Akun ini akan langsung keluar dari semua perangkat, dan tidak bisa login lagi selama beberapa menit.",
      danger: true,
    });
    if (!ok) return;
    setProcessingId(row.id);
    const res = await fetch(`/api/admin-pusat/sesi/${row.id}/force-logout`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setProcessingId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Gagal memutus sesi.");
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  const filteredSessions = (sessions ?? []).filter((row) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (row.nama ?? "").toLowerCase().includes(q) || row.email.toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const pageSessions = filteredSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sesi Aktif"
        description="Akun yang belum tercatat logout sejak login terakhirnya. Cek waktu login untuk menilai kewajaran — bukan jaminan sesinya masih dipakai detik ini."
      />

      {error && <Alert variant="danger">{error}</Alert>}

      {!error && sessions !== null && sessions.length === 0 && (
        <EmptyState icon={<IconInbox />} title="Tidak ada sesi aktif" description="Belum ada yang login." />
      )}

      {sessions !== null && sessions.length > 0 && (
        <div className="w-64">
          <Label htmlFor="searchSesi">Cari nama/email</Label>
          <Input
            id="searchSesi"
            placeholder="Ketik nama atau email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      )}

      {sessions !== null && sessions.length > 0 && filteredSessions.length === 0 && (
        <EmptyState icon={<IconSearch />} title="Tidak ditemukan" description={`Tidak ada sesi yang cocok dengan "${search}".`} />
      )}

      {filteredSessions.length > 0 && (
        <>
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
              {pageSessions.map((row) => (
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
        <Pagination page={page} totalPages={totalPages} totalItems={filteredSessions.length} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
