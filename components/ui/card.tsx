import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md", className)}
      {...props}
    />
  );
}
