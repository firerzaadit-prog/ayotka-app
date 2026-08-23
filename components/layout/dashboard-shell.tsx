"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function DashboardShell({
  title,
  email,
  nav,
  children,
}: {
  title: string;
  email: string;
  nav?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-slate-900">AyoTKA — {title}</span>
          {nav}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{email}</span>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Keluar
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
