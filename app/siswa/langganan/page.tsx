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
  referralCode: string;
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

  const [copied, setCopied] = useState(false);

  async function handleCopyReferral(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API tidak tersedia - kode tetap terlihat untuk disalin manual.
    }
  }

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
      <div className="flex flex-col gap-4">
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
        <Card>
          <p className="text-sm text-slate-500">Kode referral kamu</p>
          <p className="mt-1 text-sm text-slate-600">
            Bagikan ke temanmu yang daftar mandiri — mereka dapat diskon 30% untuk pembelian pertama.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-md bg-slate-100 px-3 py-1.5 font-mono text-sm font-semibold text-slate-900">
              {data.referralCode}
            </span>
            <Button variant="secondary" onClick={() => handleCopyReferral(data.referralCode)}>
              {copied ? "Disalin!" : "Salin kode"}
            </Button>
          </div>
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
          <div className="grid gap-4 sm:grid-cols-2">
            {data.plans.map((p) => {
              const isSemester = p.durasiHari && p.durasiHari >= 90;
              return (
                <div
                  key={p.id}
                  className={`flex flex-col justify-between rounded-2xl border p-5 shadow-sm transition-all ${
                    isSemester
                      ? "border-indigo-300 bg-gradient-to-b from-indigo-50/50 via-white to-white ring-2 ring-indigo-500/20"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[0.68rem] font-bold ${
                          isSemester
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isSemester ? "★ REKOMENDASI TERBAIK" : "AKSES FLEKSIBEL"}
                      </span>
                      {p.durasiHari && (
                        <span className="font-mono text-xs text-slate-500">{p.durasiHari} hari</span>
                      )}
                    </div>

                    <p className="mt-3 text-xl font-bold text-slate-900">{p.nama}</p>
                    <p className="mt-1 text-2xl font-black text-indigo-700">{formatRupiah(p.harga)}</p>

                    <ul className="mt-4 flex flex-col gap-2 text-xs text-slate-600">
                      {isSemester ? (
                        <>
                          <li className="flex items-start gap-2 font-semibold text-indigo-950">
                            <span className="text-amber-500 font-bold">★</span>
                            <span>Mendapatkan Try Out Nasional 3 kali per mapel</span>
                          </li>
                          <li className="flex items-start gap-2 font-semibold text-indigo-950">
                            <span className="text-amber-500 font-bold">★</span>
                            <span>Plus Learning Analytics AI lengkap di TO Nasional</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Try Out Mandiri tanpa batas semua mapel</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Akses skor nilai &amp; peta kompetensi sepuasnya</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-indigo-600 font-bold">✦</span>
                            <span>Plus 1x Analisis AI per mapel untuk TO Mandiri</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Laporan berkala komprehensif untuk orang tua</span>
                          </li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Try Out Mandiri tanpa batas semua mapel</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Akses skor nilai &amp; peta kompetensi sepuasnya</span>
                          </li>
                          <li className="flex items-start gap-2 font-medium text-indigo-900">
                            <span className="text-indigo-600 font-bold">✦</span>
                            <span>Plus 1x Learning Analytics AI per mapel</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Laporan bulanan berkala untuk orang tua</span>
                          </li>
                          <li className="flex items-start gap-2 text-slate-400">
                            <span className="text-slate-400 font-bold">✕</span>
                            <span className="line-through">Tidak termasuk Try Out Nasional</span>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>

                  <Button
                    className={`mt-5 w-full ${isSemester ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                    disabled={submittingPlanId !== null || Boolean(data.pendingInvoiceId)}
                    onClick={() => handleBeli(p.id)}
                  >
                    {submittingPlanId === p.id ? "Memproses..." : "Bayar Sekarang"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Card>
        <p className="text-sm text-slate-500">Kode referral kamu</p>
        <p className="mt-1 text-sm text-slate-600">
          Bagikan ke temanmu yang daftar mandiri — mereka dapat diskon 30% untuk pembelian pertama.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-md bg-slate-100 px-3 py-1.5 font-mono text-sm font-semibold text-slate-900">
            {data.referralCode}
          </span>
          <Button variant="secondary" onClick={() => handleCopyReferral(data.referralCode)}>
            {copied ? "Disalin!" : "Salin kode"}
          </Button>
        </div>
      </Card>

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
