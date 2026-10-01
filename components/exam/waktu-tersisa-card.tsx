"use client";

import { cn } from "@/lib/utils/cn";
import { formatSisaWaktuPanjang, nadaWaktu } from "@/lib/exam/format-waktu";

const NADA_CLASS = {
  normal: { angka: "text-indigo-700", bar: "from-indigo-500 to-violet-500", kartu: "border-slate-200 bg-white" },
  waspada: { angka: "text-amber-600", bar: "from-amber-400 to-orange-500", kartu: "border-amber-200 bg-amber-50/60" },
  kritis: { angka: "text-rose-600", bar: "from-rose-500 to-red-500", kartu: "border-rose-200 bg-rose-50/60" },
} as const;

/** Kartu "Waktu Tersisa" di sisi kanan halaman ujian: hitung mundur besar + bar sisa waktu. */
export function WaktuTersisaCard({ remaining, totalDetik }: { remaining: number; totalDetik: number }) {
  const nada = NADA_CLASS[nadaWaktu(remaining)];
  const persen = totalDetik > 0 ? Math.min(100, Math.max(0, (remaining / totalDetik) * 100)) : 0;

  return (
    <div className={cn("rounded-2xl border p-4 text-center shadow-sm transition-colors", nada.kartu)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Waktu Tersisa</p>
      <p
        className={cn("mt-2 text-2xl font-extrabold leading-tight tabular-nums", nada.angka)}
        role="timer"
        aria-live="off"
      >
        {formatSisaWaktuPanjang(remaining)}
      </p>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label="Sisa waktu ujian"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(persen)}
      >
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-1000 ease-linear", nada.bar)}
          style={{ width: `${persen}%` }}
        />
      </div>
    </div>
  );
}
