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
  const [loginMenuOpen, setLoginMenuOpen] = useState(false);

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

          {/* Tombol Masuk dengan Dropdown Pilihan Portal */}
          <div className="relative" onMouseLeave={() => setLoginMenuOpen(false)}>
            <button
              type="button"
              onClick={() => setLoginMenuOpen((v) => !v)}
              onMouseEnter={() => setLoginMenuOpen(true)}
              className={`${MASUK_CLASS} inline-flex items-center gap-1.5 cursor-pointer`}
              aria-expanded={loginMenuOpen}
            >
              <span>Masuk</span>
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`h-4 w-4 transition-transform duration-200 ${loginMenuOpen ? "rotate-180" : ""}`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {loginMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10 transition-all z-50"
                onMouseEnter={() => setLoginMenuOpen(true)}
              >
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Pilih Portal Masuk
                </div>
                <Link
                  href="/login"
                  onClick={() => setLoginMenuOpen(false)}
                  className="flex flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="text-sm font-semibold text-slate-900">Siswa</span>
                  <span className="text-xs text-slate-500">Mengerjakan try out &amp; rapor</span>
                </Link>
                <Link
                  href="/mitra/login"
                  onClick={() => setLoginMenuOpen(false)}
                  className="flex flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-indigo-50/70"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-indigo-700">Mitra &amp; Reseller</span>
                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">Portal</span>
                  </div>
                  <span className="text-xs text-slate-500">Beli &amp; kelola voucher siswa</span>
                </Link>
                <Link
                  href="/admin/admin-sekolah"
                  onClick={() => setLoginMenuOpen(false)}
                  className="flex flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="text-sm font-semibold text-slate-900">Admin Sekolah</span>
                  <span className="text-xs text-slate-500">Kelola rombel &amp; siswa sekolah</span>
                </Link>
                <Link
                  href="/admin/dinas-pendidikan"
                  onClick={() => setLoginMenuOpen(false)}
                  className="flex flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="text-sm font-semibold text-slate-900">Dinas Pendidikan</span>
                  <span className="text-xs text-slate-500">Pantau kesiapan wilayah</span>
                </Link>
              </div>
            )}
          </div>

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
          <div className="my-1 border-t border-slate-100" />
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Masuk sebagai Siswa
          </Link>
          <Link
            href="/mitra/login"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-indigo-50/70 px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100/70"
          >
            Masuk sebagai Mitra &amp; Reseller
          </Link>
          <Link
            href="/admin/admin-sekolah"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
          >
            Masuk sebagai Admin Sekolah
          </Link>
        </nav>
      )}
    </header>
  );
}
