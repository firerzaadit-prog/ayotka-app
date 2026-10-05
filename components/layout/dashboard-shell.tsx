"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import Image from "next/image";

export function DashboardShell({
  title,
  akun,
  akunDetail,
  nav,
  banner,
  children,
}: {
  title: string;
  /** Label akun di pojok kanan atas: nama siswa / sekolah / mitra / dinas (lib/auth/nama-akun.ts); admin pusat memakai email. */
  akun: string;
  /** Keterangan saat kursor diarahkan ke label akun (mis. email akun), supaya akun tetap bisa dikenali. */
  akunDetail?: string;
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
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-5 bg-white">
      <div className="flex items-center gap-2.5">
        <div className="relative h-9 w-9 shrink-0">
          <Image
            src="/logo.png"
            alt="AyoTKA Logo"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div>
          <p className="text-base font-bold tracking-tight text-slate-900 leading-none">AyoTKA</p>
          <span className="mt-1 inline-block rounded-full bg-gradient-to-r from-indigo-50 to-violet-50 px-2 py-0.5 text-[0.65rem] font-semibold text-indigo-700 border border-indigo-200/60 leading-tight">
            {title}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/70 lg:flex">
      {/*
        Sidebar desktop: elemen TERPISAH dari drawer mobile di bawah, cuma
        ditampilkan lewat `hidden lg:flex` (bukan position/transform yang
        berubah per breakpoint) supaya tidak pernah salah "nyangkut" jadi
        fixed+overlap di atas konten pada lebar layar yang jadi ambigu.
      */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white shadow-[1px_0_3px_rgba(0,0,0,0.02)] lg:flex">
        {brand}
        <nav className="flex-1 overflow-y-auto px-3 py-4">{nav}</nav>
      </aside>

      {/* Drawer mobile: fixed + geser, dan disembunyikan total (display:none) di lg: ke atas lewat lg:hidden. */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200/80 bg-white shadow-xl transition-transform lg:hidden ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pr-3">
          {brand}
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Tutup menu"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">{nav}</nav>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
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
            {/* Di layar sangat sempit nama AyoTKA/peran disembunyikan supaya nama akun di kanan tetap terbaca
                (merek & peran tetap ada di menu samping). */}
            <div className="flex items-center gap-2 lg:hidden">
              <span className="hidden text-sm font-bold text-slate-900 min-[420px]:inline">AyoTKA</span>
              <span className="hidden text-xs text-slate-400 sm:inline">&middot;</span>
              <span className="hidden text-xs font-semibold text-indigo-600 sm:inline">{title}</span>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex min-w-0 items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-xs sm:px-3">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
              <span className="min-w-0 max-w-[10rem] truncate sm:max-w-[16rem]" title={akunDetail ?? akun}>
                {akun}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              Keluar
            </button>
          </div>
        </header>
        {banner}
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
