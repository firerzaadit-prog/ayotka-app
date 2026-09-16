"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const NAV_LINKS = [
  { href: "/kerangka-asesmen", label: "Kerangka Asesmen" },
  { href: "/#cara-kerja", label: "Cara Kerja" },
  { href: "/#harga", label: "Harga" },
  { href: "/#faq", label: "Tanya Jawab" },
] as const;

const MASUK_CLASS =
  "border border-card-ink/30 bg-white px-4 py-2 font-card text-sm font-semibold text-card-ink transition-colors hover:border-card-ink/60";

const DAFTAR_CLASS =
  "border border-card-ink bg-card-ink px-4 py-2 font-card text-sm font-semibold text-card-paper transition-transform hover:-translate-y-0.5";

/**
 * Dipakai di semua halaman publik (landing, Kerangka Asesmen). Identitas
 * "Kartu Peserta Ujian": tombol jadi persegi rata (bukan pil gradient),
 * wordmark pakai font-card-serif.
 */
export function PublicHeader({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);

  function linkClass(href: (typeof NAV_LINKS)[number]["href"]) {
    return href === active
      ? "font-card text-sm font-medium text-card-ink"
      : "font-card text-sm font-medium text-card-ink/60 hover:text-card-ink";
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-card-ink/15 bg-card-paper/90 px-6 py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-card-serif text-lg font-semibold tracking-tight text-card-ink">
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
            className="flex h-11 w-11 items-center justify-center border border-card-ink/20 text-card-ink/70 hover:bg-card-ink/5"
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
        <nav className="mx-auto mt-4 flex max-w-6xl flex-col gap-1 border-t border-card-ink/10 pt-4 sm:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={
                link.href === active
                  ? "bg-card-ink/8 px-3 py-2 font-card text-sm font-medium text-card-ink"
                  : "px-3 py-2 font-card text-sm font-medium text-card-ink/60 hover:text-card-ink"
              }
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="px-3 py-2 font-card text-sm font-medium text-card-ink/60 hover:text-card-ink"
          >
            Masuk
          </Link>
        </nav>
      )}
    </header>
  );
}
