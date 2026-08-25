"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
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
const STATUS_VARIANT: Record<EffectiveStatus, "success" | "warning" | "danger" | "neutral"> = {
  aktif: "success",
  tenggang: "warning",
  kedaluwarsa: "danger",
  batal: "neutral",
};

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  menunggu_verifikasi: "Menunggu verifikasi",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  kedaluwarsa: "Kedaluwarsa",
};
const ORDER_STATUS_VARIANT: Record<OrderStatus, "warning" | "success" | "danger" | "neutral"> = {
  menunggu_verifikasi: "warning",
  disetujui: "success",
  ditolak: "danger",
  kedaluwarsa: "neutral",
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
        <PageHeader title="Langganan" />
        <Card>
          <p className="text-sm text-slate-600">
            Akunmu terdaftar lewat sekolah. Akses ujian ditanggung langganan sekolahmu - kamu tidak
            perlu berlangganan sendiri.
          </p>
        </Card>
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
            <Badge variant={STATUS_VARIANT[sub.subscription.status]}>
              {STATUS_LABEL[sub.subscription.status]}
            </Badge>{" "}
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
          <Alert variant="warning">
            Order kamu untuk paket &quot;{pendingOrder.plan.nama}&quot; sedang menunggu verifikasi
            admin. Tunggu itu diproses sebelum membuat order baru.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
            {error && <Alert variant="danger">{error}</Alert>}
            {success && (
              <Alert variant="success">
                Order terkirim. Admin akan memverifikasi bukti transfermu.
              </Alert>
            )}

            <div>
              <Label htmlFor="plan">Paket langganan</Label>
              <select
                id="plan"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
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
              <Alert variant="danger">
                Belum ada rekening tujuan aktif. Hubungi admin pusat.
              </Alert>
            )}

            <div>
              <Label htmlFor="bukti">Bukti transfer (gambar/PDF, maks. 5 MB)</Label>
              <Input
                id="bukti"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Tanggal</Th>
                  <Th>Paket</Th>
                  <Th>Jumlah</Th>
                  <Th>Status</Th>
                  <Th>Catatan admin</Th>
                </Tr>
              </Thead>
              <tbody>
                {orders.map((o) => (
                  <Tr key={o.id}>
                    <Td>{formatWIBDate(o.createdAt)}</Td>
                    <Td>{o.plan.nama}</Td>
                    <Td>{formatRupiah(o.jumlah)}</Td>
                    <Td>
                      <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                        {ORDER_STATUS_LABEL[o.status]}
                      </Badge>
                    </Td>
                    <Td className="text-slate-500">{o.catatanAdmin ?? "-"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        )}
      </section>
    </div>
  );
}
