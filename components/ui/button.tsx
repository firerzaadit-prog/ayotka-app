import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-600/25 hover:shadow-md hover:shadow-indigo-600/35 hover:brightness-105 active:scale-[0.98]",
  secondary:
    "bg-white text-slate-700 border border-slate-200/90 shadow-xs hover:border-slate-300 hover:bg-slate-50/80 active:scale-[0.98]",
  danger:
    "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-sm shadow-rose-600/25 hover:shadow-md hover:shadow-rose-600/35 hover:brightness-105 active:scale-[0.98]",
};

/**
 * Kelas Button yang sama, dipakai juga untuk elemen non-<button> yang perlu
 * terlihat seperti tombol (mis. next/link <Link> di quick-actions dashboard).
 */
export function buttonClassName(variant: Variant = "primary", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium tracking-tight transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100",
    VARIANT_CLASSES[variant],
    className,
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className, variant = "primary", disabled, ...props }, ref) => (
  <button ref={ref} disabled={disabled} className={buttonClassName(variant, className)} {...props} />
));
Button.displayName = "Button";
