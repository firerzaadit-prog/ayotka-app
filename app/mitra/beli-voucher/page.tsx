"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PageSkeleton } from "@/components/ui/skeleton";
import { computeVoucherOrderAmount, type VoucherPriceTier } from "@/lib/billing/voucher-pricing";

type Plan = { id: string; kode: string; nama: string; harga: number; durasiHari: number | null };
type CheckoutData = { plans: Plan[]; pendingOrderId: string | null; tiers: VoucherPriceTier[] };

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/**
 * Jalur C lewat Midtrans (permintaan user): mitra beli batch voucher sendiri
 * dengan diskon grosir bertingkat (lihat VOUCHER_PRICE_TIERS) - lihat
 * app/api/mitra/vouchers/checkout. Begitu lunas, kode voucher muncul
 * otomatis di /mitra/dashboard tanpa perlu admin pusat generate manual lagi.
 */
export default function BeliVoucherPage() {
  const [data, setData] = useState<CheckoutData | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [jumlah, setJumlah] = useState("10");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/mitra/vouchers/checkout");
      const json = await res.json().catch(() => null);
      if (!ignore && res.ok) {
        setData(json);
        if (json.plans?.length > 0) setSelectedPlanId(json.plans[0].id);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleBeli() {
    setError(null);
    if (!selectedPlanId) {
      setError("Pilih plan terlebih dahulu.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/mitra/vouchers/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: selectedPlanId, jumlah: Number(jumlah) }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error ?? "Gagal membuat transaksi pembayaran.");
      setSubmitting(false);
      return;
    }
    window.location.assign(json.redirectUrl);
  }

  if (!data) {
    return <PageSkeleton />;
  }

  const selectedPlan = data.plans.find((p) => p.id === selectedPlanId);
  const { amount: totalHarga, diskonPersen } = selectedPlan
    ? computeVoucherOrderAmount(data.tiers, selectedPlan.harga, Number(jumlah || 0))
    : { amount: 0, diskonPersen: 0 };
  const hargaSebelumDiskon = selectedPlan ? selectedPlan.harga * Number(jumlah || 0) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Beli Voucher"
        description="Bayar secara online (QRIS / Transfer Bank), dapatkan kode voucher instan yang siap dibagikan ke siswa."
      />

      {error && <Alert variant="danger">{error}</Alert>}

      {data.pendingOrderId && (
        <Alert variant="warning">
          Kamu masih punya pesanan voucher yang belum dibayar. Selesaikan pembayaran itu dulu, atau
          tunggu sampai kedaluwarsa (24 jam) sebelum beli lagi.
        </Alert>
      )}

      {data.plans.length === 0 ? (
        <Alert variant="danger">Belum ada paket yang tersedia. Hubungi admin pusat.</Alert>
      ) : (
        <Card className="flex flex-col gap-4">
          <div>
            <Label htmlFor="plan">Plan</Label>
            <select
              id="plan"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
            >
              {data.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} — {formatRupiah(p.harga)}
                  {p.durasiHari ? ` / ${p.durasiHari} hari` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="jumlah">Jumlah voucher</Label>
            <Input
              id="jumlah"
              type="number"
              min={1}
              max={500}
              required
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
            />
          </div>
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <p className="text-slate-500">Total pembayaran</p>
            {diskonPersen > 0 ? (
              <>
                <p className="text-xs text-slate-400 line-through">{formatRupiah(hargaSebelumDiskon)}</p>
                <p className="text-xl font-bold text-indigo-700">{formatRupiah(totalHarga)}</p>
                <p className="text-xs font-medium text-emerald-600">Diskon grosir {diskonPersen}% diterapkan</p>
              </>
            ) : (
              <p className="text-xl font-bold text-indigo-700">{formatRupiah(totalHarga)}</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-500">
            <p className="mb-1.5 font-medium text-slate-600">Diskon grosir</p>
            <ul className="flex flex-col gap-0.5">
              {data.tiers
                .slice()
                .sort((a, b) => b.minJumlah - a.minJumlah)
                .map((t) => (
                  <li key={t.label}>
                    {t.label}: {t.diskonPersen > 0 ? `diskon ${t.diskonPersen}%` : "harga penuh"}
                  </li>
                ))}
            </ul>
          </div>

          <Button
            onClick={handleBeli}
            disabled={submitting || Boolean(data.pendingOrderId)}
            className="w-fit"
          >
            {submitting ? "Memproses..." : "Bayar Sekarang"}
          </Button>
        </Card>
      )}
    </div>
  );
}
