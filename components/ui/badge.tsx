import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "neutral" | "success" | "warning" | "danger" | "info";

const VARIANT_CLASSES: Record<Variant, string> = {
  neutral: "bg-slate-50 text-slate-600 border-slate-200/80",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
  warning: "bg-amber-50 text-amber-800 border-amber-200/70",
  danger: "bg-rose-50 text-rose-700 border-rose-200/70",
  info: "bg-indigo-50 text-indigo-700 border-indigo-200/70",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide shadow-xs",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
