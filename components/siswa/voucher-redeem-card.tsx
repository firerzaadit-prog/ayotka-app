"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { formatWIBDate } from "@/lib/utils/datetime";

export function VoucherRedeemCard({
  onSuccess,
}: {
  onSuccess?: () => void;
  compact?: boolean;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    endsAt: string;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setError(null);
    setSuccessData(null);
    setLoading(true);

    try {
      const res = await fetch("/api/siswa/vouchers/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Gagal menukarkan kode voucher. Pastikan kode benar.");
        return;
      }

      setSuccessData({
        endsAt: data.entitlement?.endsAt,
      });
      setCode("");
      if (onSuccess) onSuccess();
    } catch {
      setError("Gagal terhubung ke server. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/40 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-600/25">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900">Tukar Kode Voucher Mitra</h3>
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-indigo-700">
                Akses Instan
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-xl">
              Punya kode akses atau voucher dari Mitra/Reseller AyoTKA? Masukkan kode voucher Anda di bawah ini untuk langsung mengaktifkan langganan belajar.
            </p>
          </div>
        </div>
      </div>

      {successData && (
        <Alert variant="success" className="mt-4">
          <p className="font-semibold text-emerald-900">Voucher berhasil ditukarkan!</p>
          <p className="text-xs text-emerald-700 mt-0.5">
            Akses paket belajar Anda telah aktif sampai{" "}
            <strong>{formatWIBDate(successData.endsAt)}</strong>. Anda kini dapat mengakses try out sesuai paket yang diberikan.
          </p>
        </Alert>
      )}

      {error && <Alert variant="danger" className="mt-4">{error}</Alert>}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="voucherInput" className="font-mono text-xs font-bold uppercase tracking-wider text-slate-600">
            Masukkan Kode Voucher (10 Karakter)
          </Label>
          <Input
            id="voucherInput"
            required
            autoCapitalize="characters"
            placeholder="CONTOH: AB12CD34EF"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="mt-1.5 h-11 font-mono uppercase tracking-widest text-sm font-semibold placeholder:text-slate-400 placeholder:tracking-normal focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !code.trim()}
          className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold px-6 shadow-sm shadow-indigo-600/25 transition-all"
        >
          {loading ? "Memproses..." : "Tukarkan Voucher"}
        </Button>
      </form>
    </div>
  );
}
