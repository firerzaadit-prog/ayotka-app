"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { formatWIBDate } from "@/lib/utils/datetime";

type Plan = { id: string; nama: string; harga: number; durasiHari: number };
type BankAccount = { id: string; namaBank: string; nomorRekening: string; atasNama: string };
type EffectiveStatus = "aktif" | "tenggang" | "kedaluwarsa" | "batal";
type OrderStatus = "menunggu_verifikasi" | "disetujui" | "ditolak" | "kedaluwarsa";
type Order = {
  id: string;
  jumlah: number;
  status: OrderStatus;
  catatanAdmin: string | null;
  createdAt: string;
  plan: { nama: string };
};

type SubscriptionResponse =
  | { jalur: "A" }
  | { jalur: "B"; subscription: { planNama: string; berakhirAt: string; status: EffectiveStatus } | null };

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

const STATUS_LABEL: Record<EffectiveStatus, string> = {
  aktif: "Aktif",
  tenggang: "Masa tenggang",
  kedaluwarsa: "Kedaluwarsa",
  batal: "Dibatalkan",
};
const STATUS_BADGE_CLASS: Record<EffectiveStatus, string> = {
  aktif: "bg-green-100 text-green-700",
  tenggang: "bg-amber-100 text-amber-700",
  kedaluwarsa: "bg-red-100 text-red-700",
  batal: "bg-slate-100 text-slate-500",
};

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  menunggu_verifikasi: "Menunggu verifikasi",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  kedaluwarsa: "Kedaluwarsa",
};
const ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  menunggu_verifikasi: "bg-amber-100 text-amber-700",
  disetujui: "bg-green-100 text-green-700",
  ditolak: "bg-red-100 text-red-700",
  kedaluwarsa: "bg-slate-100 text-slate-500",
};

/** Tiket 6.3 (Bagian 7.1 brief): checkout siswa mandiri - pilih paket, transfer manual, unggah bukti. */
export default function LanggananSiswaPage() {
  const [sub, setSub] = useState<SubscriptionResponse | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);

  const [planId, setPlanId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [subRes, planRes, bankRes, orderRes] = await Promise.all([
        fetch("/api/siswa/subscription"),
        fetch("/api/siswa/plans"),
        fetch("/api/siswa/bank-accounts"),
        fetch("/api/siswa/orders"),
      ]);
      const subData = await subRes.json().catch(() => null);
      const planData = await planRes.json().catch(() => null);
      const bankData = await bankRes.json().catch(() => null);
      const orderData = await orderRes.json().catch(() => null);
      if (!ignore) {
        if (subRes.ok) setSub(subData);
        if (planRes.ok) setPlans(planData.plans ?? []);
        if (bankRes.ok) setAccounts(bankData.bankAccounts ?? []);
        if (orderRes.ok) setOrders(orderData.orders ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!planId) {
      setError("Pilih paket langganan dulu.");
      return;
    }
    if (!file) {
      setError("Unggah bukti transfer dulu.");
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("planId", planId);
    formData.set("file", file);

    const res = await fetch("/api/siswa/orders", { method: "POST", body: formData });
    const data = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(data?.error ?? "Gagal mengirim order.");
      return;
    }
    setSuccess(true);
    setPlanId("");
    setFile(null);
    setRefreshKey((k) => k + 1);
  }

  if (!sub || !plans || !accounts || !orders) {
    return <p className="text-sm text-slate-500">Memuat...</p>;
  }

  if (sub.jalur === "A") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Langganan</h1>
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Akunmu terdaftar lewat sekolah. Akses ujian ditanggung langganan sekolahmu - kamu tidak
          perlu berlangganan sendiri.
        </p>
      </div>
    );
  }

  const pendingOrder = orders.find((o) => o.status === "menunggu_verifikasi");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Langganan</h1>
        {sub.subscription ? (
          <p className="mt-1 text-sm text-slate-600">
            Paket <span className="font-medium">{sub.subscription.planNama}</span>{" "}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[sub.subscription.status]}`}
            >
              {STATUS_LABEL[sub.subscription.status]}
            </span>{" "}
            · berakhir {formatWIBDate(sub.subscription.berakhirAt)}
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-600">
            Kamu belum pernah berlangganan. Kamu bisa coba 1 paket ujian gratis sebelum
            berlangganan - lihat halaman Ujian.
          </p>
        )}
        {sub.subscription?.status === "tenggang" && (
          <p className="mt-1 text-sm text-amber-700">
            Masa tenggang 3 hari - segera perpanjang di bawah supaya akses tidak terputus.
          </p>
        )}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900">
          {sub.subscription ? "Perpanjang langganan" : "Mulai berlangganan"}
        </h2>

        {pendingOrder ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Order kamu untuk paket &quot;{pendingOrder.plan.nama}&quot; sedang menunggu verifikasi
            admin. Tunggu itu diproses sebelum membuat order baru.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {success && (
              <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                Order terkirim. Admin akan memverifikasi bukti transfermu.
              </p>
            )}

            <div>
              <Label htmlFor="plan">Paket langganan</Label>
              <select
                id="plan"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
              >
                <option value="">- Pilih paket -</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} - {formatRupiah(p.harga)} / {p.durasiHari} hari
                  </option>
                ))}
              </select>
            </div>

            {accounts.length > 0 ? (
              <div className="rounded-md bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-700">Transfer ke salah satu rekening berikut:</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {accounts.map((acc) => (
                    <li key={acc.id}>
                      <span className="font-medium">{acc.namaBank}</span>{" "}
                      <span className="font-mono">{acc.nomorRekening}</span> a.n. {acc.atasNama}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                Belum ada rekening tujuan aktif. Hubungi admin pusat.
              </p>
            )}

            <div>
              <Label htmlFor="bukti">Bukti transfer (gambar/PDF, maks. 5 MB)</Label>
              <input
                id="bukti"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting ? "Mengirim..." : "Kirim order"}
            </Button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Riwayat Order</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada order.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Tanggal</th>
                  <th className="px-4 py-2 font-medium">Paket</th>
                  <th className="px-4 py-2 font-medium">Jumlah</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Catatan admin</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">{formatWIBDate(o.createdAt)}</td>
                    <td className="px-4 py-2">{o.plan.nama}</td>
                    <td className="px-4 py-2">{formatRupiah(o.jumlah)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_BADGE_CLASS[o.status]}`}
                      >
                        {ORDER_STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{o.catatanAdmin ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
