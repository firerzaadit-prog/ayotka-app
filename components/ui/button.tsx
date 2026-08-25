import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-600/20 hover:shadow-md hover:shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500",
  secondary:
    "bg-white text-slate-700 border border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50",
  danger: "bg-rose-600 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-500",
};

/**
 * Kelas Button yang sama, dipakai juga untuk elemen non-<button> yang perlu
 * terlihat seperti tombol (mis. next/link <Link> di quick-actions dashboard).
 */
export function buttonClassName(variant: Variant = "primary", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
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
