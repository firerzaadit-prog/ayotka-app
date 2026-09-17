"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function SidebarSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      {label && (
        <p className="mb-1.5 px-3 font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-indigo-600/80">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function SidebarLinkInner({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  let active = false;
  if (href.includes("?")) {
    const [targetPath, targetQuery] = href.split("?");
    const targetParams = new URLSearchParams(targetQuery);
    const matchesPath = pathname === targetPath;
    let matchesParams = true;
    targetParams.forEach((val, key) => {
      if (searchParams.get(key) !== val) matchesParams = false;
    });
    active = matchesPath && matchesParams;
  } else {
    active = pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold text-white shadow-sm shadow-indigo-600/25"
          : "text-slate-600 hover:bg-indigo-50/60 hover:text-indigo-600",
      )}
    >
      <span>{children}</span>
      {active && (
        <span className="h-1.5 w-1.5 rounded-full bg-white/90 shadow-xs" aria-hidden="true" />
      )}
    </Link>
  );
}

export function SidebarLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <Link
          href={href}
          className="group flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-600"
        >
          <span>{children}</span>
        </Link>
      }
    >
      <SidebarLinkInner href={href}>{children}</SidebarLinkInner>
    </Suspense>
  );
}
