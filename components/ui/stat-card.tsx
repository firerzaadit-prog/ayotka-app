import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md", className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
