"use client";

import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { formatWIBDate } from "@/lib/utils/datetime";

type OrderStatus = "menunggu_verifikasi" | "disetujui" | "ditolak" | "kedaluwarsa";
type Order = {
  id: string;
  jumlah: number;
  status: OrderStatus;
  catatanAdmin: string | null;
  createdAt: string;
  user: { email: string };
  mapel: string[];
};

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  menunggu_verifikasi: "Menunggu verifikasi",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  kedaluwarsa: "Kedaluwarsa",
};
const STATUS_VARIANT: Record<OrderStatus, "warning" | "success" | "danger" | "neutral"> = {
  menunggu_verifikasi: "warning",
  disetujui: "success",
  ditolak: "danger",
  kedaluwarsa: "neutral",
};

const TABS: { value: OrderStatus | "semua"; label: string }[] = [
  { value: "menunggu_verifikasi", label: "Menunggu verifikasi" },
  { value: "disetujui", label: "Disetujui" },
  { value: "ditolak", label: "Ditolak" },
  { value: "semua", label: "Semua" },
];

/** Bagian 7.3 brief: antrean approval order paket try out per mapel - ACC menambah kuota try out mapel terkait. */
export default function VerifikasiTryOutMapelPage() {
  const [tab, setTab] = useState<OrderStatus | "semua">("menunggu_verifikasi");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [catatan, setCatatan] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setOrders(null);
      const qs = tab === "semua" ? "" : `?status=${tab}`;
      const res = await fetch(`/api/admin-pusat/subject-tryout-orders${qs}`);
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok) setOrders(data.orders ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [tab, refreshKey]);

  async function handleLihatBukti(orderId: string) {
    const res = await fetch(`/api/admin-pusat/subject-tryout-orders/${orderId}/bukti-url`);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(data?.error ?? "Gagal membuka bukti transfer.");
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  async function handleSetujui(orderId: string) {
    if (!window.confirm("ACC order ini? Kuota try out mata pelajaran siswa akan langsung bertambah.")) return;
    setBusyId(orderId);
    setActionError(null);
    const res = await fetch(`/api/admin-pusat/subject-tryout-orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setujui" }),
    });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!res.ok) {
      setActionError(data?.error ?? "Gagal menyetujui order.");
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  function handleOpenReject(orderId: string) {
    setRejectingId(orderId);
    setCatatan("");
    setActionError(null);
  }

  async function handleConfirmReject(orderId: string) {
    if (!catatan.trim()) {
      setActionError("Catatan wajib diisi saat menolak order.");
      return;
    }
    setBusyId(orderId);
    setActionError(null);
    const res = await fetch(`/api/admin-pusat/subject-tryout-orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "tolak", catatanAdmin: catatan.trim() }),
    });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!res.ok) {
      setActionError(data?.error ?? "Gagal menolak order.");
      return;
    }
    setRejectingId(null);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Verifikasi Try Out Mapel"
        description="Antrean order paket try out per mata pelajaran siswa mandiri. ACC menambah kuota try out mapel yang dipilih (kumulatif kalau mapel yang sama pernah dibeli)."
      />

      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.value
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {actionError && <Alert variant="danger">{actionError}</Alert>}

      {orders === null && <p className="text-sm text-slate-500">Memuat...</p>}
      {orders?.length === 0 && (
        <EmptyState title="Tidak ada order" description="Tidak ada order pada kategori ini." />
      )}

      {orders && orders.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Tanggal</Th>
                <Th>Siswa</Th>
                <Th>Mata pelajaran</Th>
                <Th>Jumlah</Th>
                <Th>Status</Th>
                <Th>Catatan</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <tbody>
              {orders.map((o) => (
                <Fragment key={o.id}>
                  <Tr>
                    <Td>{formatWIBDate(o.createdAt)}</Td>
                    <Td>{o.user.email}</Td>
                    <Td>{o.mapel.join(", ")}</Td>
                    <Td>{formatRupiah(o.jumlah)}</Td>
                    <Td>
                      <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    </Td>
                    <Td className="text-slate-500">{o.catatanAdmin ?? "-"}</Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleLihatBukti(o.id)}
                          className="text-sm font-medium text-slate-600 hover:text-slate-900"
                        >
                          Lihat bukti
                        </button>
                        {o.status === "menunggu_verifikasi" && (
                          <>
                            <button
                              onClick={() => handleSetujui(o.id)}
                              disabled={busyId === o.id}
                              className="text-sm font-medium text-emerald-700 hover:underline disabled:opacity-50"
                            >
                              ACC
                            </button>
                            <button
                              onClick={() => handleOpenReject(o.id)}
                              disabled={busyId === o.id}
                              className="text-sm font-medium text-rose-600 hover:underline disabled:opacity-50"
                            >
                              Tolak
                            </button>
                          </>
                        )}
                      </div>
                    </Td>
                  </Tr>
                  {rejectingId === o.id && (
                    <Tr className="bg-rose-50/50">
                      <Td colSpan={7} className="py-3">
                        <div className="flex flex-col gap-2">
                          <label className="text-sm font-medium text-slate-700">
                            Alasan penolakan (wajib, akan terlihat oleh siswa)
                          </label>
                          <textarea
                            value={catatan}
                            onChange={(e) => setCatatan(e.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="mis. bukti transfer tidak jelas / nominal tidak sesuai"
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="danger"
                              disabled={busyId === o.id}
                              onClick={() => handleConfirmReject(o.id)}
                            >
                              Tolak order
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => setRejectingId(null)}>
                              Batal
                            </Button>
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
      )}
    </div>
  );
}
