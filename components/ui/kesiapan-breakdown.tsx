import type { ReactNode } from "react";
import type { KesiapanBreakdown } from "@/lib/analytics/kesiapan";
import { cn } from "@/lib/utils/cn";

type Kategori = "kurang" | "memadai" | "baik" | "istimewa";

const KATEGORI_ORDER: Kategori[] = ["kurang", "memadai", "baik", "istimewa"];

const KATEGORI_LABEL: Record<Kategori, string> = {
  kurang: "Kurang",
  memadai: "Memadai",
  baik: "Baik",
  istimewa: "Istimewa",
};

const KATEGORI_DOT_CLASS: Record<Kategori, string> = {
  kurang: "bg-rose-400",
  memadai: "bg-amber-400",
  baik: "bg-emerald-400",
  istimewa: "bg-indigo-500",
};

/** Bar horizontal 4 segmen (Kurang/Memadai/Baik/Istimewa) + legenda jumlah & persentase tiap kategori. */
export function KesiapanBreakdownBar({
  breakdown,
  className,
}: {
  breakdown: KesiapanBreakdown;
  className?: string;
}) {
  if (breakdown.total === 0) {
    return <p className={cn("text-sm text-slate-400", className)}>Belum ada siswa yang dinilai.</p>;
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        {KATEGORI_ORDER.map((k) => {
          const pct = (breakdown[k] / breakdown.total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={k}
              className={KATEGORI_DOT_CLASS[k]}
              style={{ width: `${pct}%` }}
              title={`${KATEGORI_LABEL[k]}: ${breakdown[k]} siswa`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {KATEGORI_ORDER.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", KATEGORI_DOT_CLASS[k])} />
            {KATEGORI_LABEL[k]} {breakdown[k]} ({((breakdown[k] / breakdown.total) * 100).toFixed(0)}%)
          </span>
        ))}
      </div>
    </div>
  );
}

/** Kartu ringkas: judul + persentase kesiapan headline + rincian 4 kategori. */
export function KesiapanCard({
  title,
  breakdown,
  action,
  className,
}: {
  title: string;
  breakdown: KesiapanBreakdown;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {action}
      </div>
      <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        {breakdown.total > 0 ? `${breakdown.persentaseSiap.toFixed(0)}%` : "—"}
      </p>
      {breakdown.total > 0 && (
        <>
          <p className="text-xs text-slate-400">dari {breakdown.total} siswa dinilai</p>
          <KesiapanBreakdownBar breakdown={breakdown} className="mt-4" />
        </>
      )}
    </div>
  );
}
