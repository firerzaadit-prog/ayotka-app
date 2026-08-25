"use client";

import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatWIBDate } from "@/lib/utils/datetime";

type OrderStatus = "menunggu_verifikasi" | "disetujui" | "ditolak" | "kedaluwarsa";
type Order = {
  id: string;
  jumlah: number;
  status: OrderStatus;
  catatanAdmin: string | null;
  createdAt: string;
  user: { email: string };
  plan: { nama: string; durasiHari: number };
};

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

const TABS: { value: OrderStatus | "semua"; label: string }[] = [
  { value: "menunggu_verifikasi", label: "Menunggu verifikasi" },
  { value: "disetujui", label: "Disetujui" },
  { value: "ditolak", label: "Ditolak" },
  { value: "semua", label: "Semua" },
];

/** Tiket 6.4/6.7: antrean approval bukti transfer siswa mandiri - ACC otomatis aktivasi/perpanjang langganan. */
export default function VerifikasiPembayaranPage() {
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
      const res = await fetch(`/api/admin-pusat/orders${qs}`);
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok) setOrders(data.orders ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [tab, refreshKey]);

  async function handleLihatBukti(orderId: string) {
    const res = await fetch(`/api/admin-pusat/orders/${orderId}/bukti-url`);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(data?.error ?? "Gagal membuka bukti transfer.");
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  async function handleSetujui(orderId: string) {
    if (!window.confirm("ACC order ini? Langganan siswa akan langsung aktif/diperpanjang.")) return;
    setBusyId(orderId);
    setActionError(null);
    const res = await fetch(`/api/admin-pusat/orders/${orderId}`, {
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
    const res = await fetch(`/api/admin-pusat/orders/${orderId}`, {
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
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Verifikasi Pembayaran</h1>
        <p className="text-sm text-slate-500">
          Antrean order siswa mandiri. ACC aktivasi/perpanjang langganan otomatis; kalau siswa
          masih punya langganan yang berlaku, masa aktif bertambah dari tanggal berakhir
          sebelumnya (bukan dari hari ACC).
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.value
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {actionError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}

      {orders === null && <p className="text-sm text-slate-500">Memuat...</p>}
      {orders?.length === 0 && (
        <EmptyState title="Tidak ada order" description="Tidak ada order pada kategori ini." />
      )}

      {orders && orders.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Tanggal</th>
                <th className="px-4 py-2 font-medium">Siswa</th>
                <th className="px-4 py-2 font-medium">Paket</th>
                <th className="px-4 py-2 font-medium">Jumlah</th>
                <th className="px-4 py-2 font-medium">Catatan</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <Fragment key={o.id}>
                  <tr className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">{formatWIBDate(o.createdAt)}</td>
                    <td className="px-4 py-2">{o.user.email}</td>
                    <td className="px-4 py-2">
                      {o.plan.nama} ({o.plan.durasiHari} hari)
                    </td>
                    <td className="px-4 py-2">{formatRupiah(o.jumlah)}</td>
                    <td className="px-4 py-2 text-slate-500">{o.catatanAdmin ?? "-"}</td>
                    <td className="px-4 py-2 text-right">
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
                              className="text-sm font-medium text-green-700 hover:underline disabled:opacity-50"
                            >
                              ACC
                            </button>
                            <button
                              onClick={() => handleOpenReject(o.id)}
                              disabled={busyId === o.id}
                              className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                            >
                              Tolak
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {rejectingId === o.id && (
                    <tr className="border-b border-slate-100 bg-red-50/50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <label className="text-sm font-medium text-slate-700">
                            Alasan penolakan (wajib, akan terlihat oleh siswa)
                          </label>
                          <textarea
                            value={catatan}
                            onChange={(e) => setCatatan(e.target.value)}
                            rows={2}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
