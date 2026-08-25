import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "info" | "success" | "warning" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  info: "bg-indigo-50 text-indigo-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-rose-50 text-rose-700",
};

export function Alert({
  variant = "info",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return (
    <div
      className={cn("rounded-lg px-3.5 py-2.5 text-sm leading-relaxed", VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
}
