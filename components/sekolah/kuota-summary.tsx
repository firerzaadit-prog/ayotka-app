"use client";

import { useEffect, useState } from "react";
import { formatWIBDate } from "@/lib/utils/datetime";
import { Alert } from "@/components/ui/alert";

type SeatStatus = { seatQuota: number | null; validUntil: string | null; seatsUsed: number; isFull: boolean };

/** Ringkasan kursi (seat) sekolah yang diaktifkan admin pusat - read-only, dipakai di dashboard admin sekolah. */
export function KuotaSummary() {
  const [status, setStatus] = useState<SeatStatus | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-sekolah/kuota");
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok) setStatus(data);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  if (status === null) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-sm font-medium text-slate-700">Kursi Sekolah dari Admin Pusat</h2>
      {status.seatQuota == null ? (
        <p className="mt-2 text-sm text-slate-500">
          Kursi sekolah belum diaktifkan admin pusat. Hubungi admin pusat untuk mengaktifkan.
        </p>
      ) : (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="font-medium text-slate-800">
            {status.seatsUsed.toLocaleString("id-ID")}/{status.seatQuota.toLocaleString("id-ID")} kursi
            terpakai
          </span>
          {status.validUntil && (
            <p className="mt-0.5 text-xs text-slate-500">Berlaku sampai {formatWIBDate(status.validUntil)}</p>
          )}
        </div>
      )}
      {status.isFull && (
        <Alert variant="warning" className="mt-3">
          Kuota kursi sudah penuh. Siswa baru yang mencoba try out akan diminta menunggu - progresnya tidak
          hilang, dan otomatis lanjut begitu admin pusat menambah kuota. Hubungi admin pusat kalau perlu
          menambah kuota sekarang.
        </Alert>
      )}
    </div>
  );
}
