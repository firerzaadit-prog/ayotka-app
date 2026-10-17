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

function SidebarLinkInner({ href, icon, children }: { href: string; icon?: ReactNode; children: ReactNode }) {
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
        "group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
        active
          ? "bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold text-white shadow-md shadow-indigo-500/20"
          : "text-slate-600 hover:bg-slate-100/90 hover:text-slate-900",
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span
            className={cn(
              "shrink-0 transition-colors duration-150 [&>svg]:h-4 [&>svg]:w-4",
              active ? "text-white" : "text-slate-400 group-hover:text-indigo-600"
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <span>{children}</span>
      </div>
      {active && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white shadow-xs ml-2" aria-hidden="true" />
      )}
    </Link>
  );
}

export function SidebarLink({ href, icon, children }: { href: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <Link
          href={href}
          className="group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className="shrink-0 text-slate-400 [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">
                {icon}
              </span>
            )}
            <span>{children}</span>
          </div>
        </Link>
      }
    >
      <SidebarLinkInner href={href} icon={icon}>{children}</SidebarLinkInner>
    </Suspense>
  );
}
