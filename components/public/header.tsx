"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const NAV_LINKS = [
  { href: "/", label: "Beranda" },
  { href: "/kerangka-asesmen", label: "Kerangka Asesmen" },
  { href: "/registrasi", label: "Daftar" },
] as const;

const CTA_CLASS =
  "rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-all hover:shadow-md hover:shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500";

/**
 * Dipakai di semua halaman publik (landing, Kerangka Asesmen) - sebelumnya
 * markup header disalin di tiap halaman dan link nav (Beranda/Kerangka
 * Asesmen/Daftar) cuma disembunyikan `sm:inline` tanpa pengganti di mobile,
 * jadi tidak bisa diakses sama sekali di layar sempit. Diekstrak jadi satu
 * komponen supaya perbaikan menu mobile ini tidak perlu diulang tiap ada
 * halaman publik baru, dan tidak lagi gampang tidak-sinkron antar halaman
 * (pernah kejadian - link "Beranda" ketinggalan di salah satu halaman).
 */
export function PublicHeader({ active }: { active: (typeof NAV_LINKS)[number]["href"] }) {
  const [open, setOpen] = useState(false);

  function linkClass(href: (typeof NAV_LINKS)[number]["href"]) {
    return href === active
      ? "text-sm font-medium text-slate-900"
      : "text-sm font-medium text-slate-600 hover:text-slate-900";
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
          <div className="relative h-10 w-10 shrink-0">
            <Image src="/logo.png" alt="AyoTKA Logo" fill sizes="40px" className="object-contain" />
          </div>
          AyoTKA
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}
          <Link href="/login" className={CTA_CLASS}>
            Masuk
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:hidden">
          <Link href="/login" className={CTA_CLASS}>
            Masuk
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              {open ? (
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="mx-auto mt-4 flex max-w-6xl flex-col gap-1 border-t border-slate-100 pt-4 sm:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={
                link.href === active
                  ? "rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700"
                  : "rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
