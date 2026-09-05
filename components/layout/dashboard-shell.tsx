"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import Image from "next/image";

export function DashboardShell({
  title,
  email,
  nav,
  banner,
  children,
}: {
  title: string;
  email: string;
  nav?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const brand = (
    <div className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-100 px-5">
      <div className="relative h-10 w-10 shrink-0">
        <Image
          src="/logo.png"
          alt="AyoTKA Logo"
          fill
          className="object-contain"
        />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-slate-900">AyoTKA</p>
        <p className="text-xs text-slate-400">{title}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/*
        Sidebar desktop: elemen TERPISAH dari drawer mobile di bawah, cuma
        ditampilkan lewat `hidden lg:flex` (bukan position/transform yang
        berubah per breakpoint) supaya tidak pernah salah "nyangkut" jadi
        fixed+overlap di atas konten pada lebar layar yang jadi ambigu.
      */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        {brand}
        <nav className="flex-1 overflow-y-auto px-3 py-4">{nav}</nav>
      </aside>

      {/* Drawer mobile: fixed + geser, dan disembunyikan total (display:none) di lg: ke atas lewat lg:hidden. */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:hidden ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {brand}
        <nav className="flex-1 overflow-y-auto px-3 py-4">{nav}</nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="Buka menu"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <span className="text-sm font-semibold text-slate-900 lg:hidden">
              AyoTKA — {title}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 sm:inline">{email}</span>
            <button
              onClick={handleLogout}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Keluar
            </button>
          </div>
        </header>
        {banner}
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
