"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function SidebarSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      {label && (
        <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export function SidebarLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-indigo-50 text-indigo-700"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
      )}
    >
      {children}
    </Link>
  );
}
