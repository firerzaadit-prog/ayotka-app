"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const NAV_LINKS = [
  { href: "/", label: "Beranda" },
  { href: "/kerangka-asesmen", label: "Kerangka Asesmen" },
  { href: "/#cara-kerja", label: "Cara Kerja" },
  { href: "/#harga", label: "Harga" },
  { href: "/#faq", label: "Tanya Jawab" },
] as const;

const MASUK_CLASS =
  "rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-all hover:shadow-md hover:shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500";

const DAFTAR_CLASS =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800";

export function PublicHeader({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);

  function linkClass(href: (typeof NAV_LINKS)[number]["href"]) {
    return href === active
      ? "text-sm font-semibold text-indigo-600"
      : "text-sm font-medium text-slate-600 transition-colors hover:text-indigo-600";
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 px-6 py-3.5 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 transition-opacity hover:opacity-90">
          <div className="relative h-9 w-9 shrink-0">
            <Image src="/logo.png" alt="AyoTKA Logo" fill sizes="36px" className="object-contain" priority />
          </div>
          <span>AyoTKA</span>
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}
          <Link href="/login" className={MASUK_CLASS}>
            Masuk
          </Link>
          <Link href="/registrasi" className={DAFTAR_CLASS}>
            Daftar
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:hidden">
          <Link href="/registrasi" className={DAFTAR_CLASS}>
            Daftar
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
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
        <nav className="mx-auto mt-3 flex max-w-6xl flex-col gap-1 border-t border-slate-100 pt-3 sm:hidden">
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
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            Masuk
          </Link>
        </nav>
      )}
    </header>
  );
}
