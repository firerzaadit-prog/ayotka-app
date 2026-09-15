"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeleton";
import { formatWIBDate } from "@/lib/utils/datetime";

type Plan = { id: string; kode: string; nama: string; harga: number; durasiHari: number | null };
type Entitlement = {
  endsAt: string;
  canStartNewAttempt: boolean;
  canViewHistory: boolean;
  source: "invoice" | "voucher" | "school_seat";
};
type CheckoutData = {
  jalur: "A" | "B";
  sekolah: { nama: string } | null;
  entitlement: Entitlement | null;
  plans: Plan[];
  pendingInvoiceId: string | null;
};

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

const SUMBER_LABEL: Record<Entitlement["source"], string> = {
  invoice: "Pembayaran mandiri",
  voucher: "Kode voucher",
  school_seat: "Kuota sekolah",
};

/** Jalur A (siswa individu, Bagian 5 dokumen rencana): checkout lewat Midtrans Snap. */
export default function LanggananSiswaPage() {
  const [data, setData] = useState<CheckoutData | null>(null);
  const [submittingPlanId, setSubmittingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [voucherCode, setVoucherCode] = useState("");
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherSubmitting, setVoucherSubmitting] = useState(false);
  const [voucherSuccess, setVoucherSuccess] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/siswa/checkout");
      const json = await res.json().catch(() => null);
      if (!ignore && res.ok) setData(json);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleBeli(planId: string) {
    setError(null);
    setSubmittingPlanId(planId);
    const res = await fetch("/api/siswa/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error ?? "Gagal membuat transaksi pembayaran.");
      setSubmittingPlanId(null);
      return;
    }
    window.location.assign(json.redirectUrl);
  }

  async function handleRedeemVoucher(e: FormEvent) {
    e.preventDefault();
    setVoucherError(null);
    setVoucherSuccess(false);
    setVoucherSubmitting(true);
    const res = await fetch("/api/siswa/vouchers/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: voucherCode }),
    });
    const json = await res.json().catch(() => null);
    setVoucherSubmitting(false);
    if (!res.ok) {
      setVoucherError(json?.error ?? "Gagal menukar kode voucher.");
      return;
    }
    setVoucherCode("");
    setVoucherSuccess(true);
    const refreshed = await fetch("/api/siswa/checkout");
    const refreshedJson = await refreshed.json().catch(() => null);
    if (refreshed.ok) setData(refreshedJson);
  }

  if (!data) {
    return <PageSkeleton />;
  }

  if (data.jalur === "A") {
    return (
      <div className="flex flex-col gap-2">
        <PageHeader title="Langganan" />
        <Card>
          <p className="text-sm text-slate-600">
            Akunmu terdaftar lewat sekolah
            {data.sekolah ? (
              <>
                {" "}
                <span className="font-semibold text-slate-900">{data.sekolah.nama}</span>
              </>
            ) : (
              ""
            )}
            . Akses Try Out ditanggung oleh sekolahmu — kamu tidak perlu membeli paket sendiri.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Langganan"
        description="Kamu terdaftar sebagai siswa mandiri (bukan lewat sekolah) — beli paket langganan untuk akses try out tanpa batas."
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <p className="text-sm text-slate-500">Status akses</p>
        {data.entitlement ? (
          <>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {data.entitlement.canStartNewAttempt ? "Aktif" : "Sudah berakhir"} — berlaku sampai{" "}
              {formatWIBDate(data.entitlement.endsAt)}
            </p>
            <Badge variant="neutral">{SUMBER_LABEL[data.entitlement.source]}</Badge>
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-600">
            Belum ada langganan aktif. Kamu masih punya jatah 1× try out gratis per mata pelajaran.
          </p>
        )}
      </Card>

      {data.pendingInvoiceId && (
        <Alert variant="warning">
          Kamu masih punya pembayaran yang tertunda. Selesaikan pembayaran itu dulu, atau tunggu sampai
          kedaluwarsa (24 jam) sebelum membeli paket baru.
        </Alert>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Pilih Paket</h2>
        {data.plans.length === 0 ? (
          <Alert variant="danger">Belum ada paket langganan yang tersedia. Hubungi admin pusat.</Alert>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.plans.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-semibold text-slate-900">{p.nama}</p>
                <p className="mt-1 text-2xl font-bold text-indigo-700">{formatRupiah(p.harga)}</p>
                {p.durasiHari && <p className="text-xs text-slate-500">Berlaku {p.durasiHari} hari</p>}
                <Button
                  className="mt-3 w-full"
                  disabled={submittingPlanId !== null || Boolean(data.pendingInvoiceId)}
                  onClick={() => handleBeli(p.id)}
                >
                  {submittingPlanId === p.id ? "Memproses..." : "Bayar dengan Midtrans"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Punya kode voucher?</h2>
        <p className="text-sm text-slate-600">
          Kalau kamu dapat kode voucher dari mitra AyoTKA, tukarkan di sini untuk langsung
          aktifkan aksesmu.
        </p>
        {voucherSuccess && <Alert variant="success">Voucher berhasil ditukar — akses kamu sudah aktif.</Alert>}
        {voucherError && <Alert variant="danger">{voucherError}</Alert>}
        <form onSubmit={handleRedeemVoucher} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="voucherCode">Kode voucher</Label>
            <Input
              id="voucherCode"
              required
              placeholder="mis. AB12CD34EF"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={voucherSubmitting || !voucherCode.trim()}>
            {voucherSubmitting ? "Menukar..." : "Tukar kode"}
          </Button>
        </form>
      </section>
    </div>
  );
}
