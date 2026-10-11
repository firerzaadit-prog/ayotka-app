"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { GraduationCap, Handshake, School, Building2 } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Beranda" },
  { href: "/kerangka-asesmen", label: "Kerangka Asesmen" },
  { href: "/#cara-kerja", label: "Cara Kerja" },
  { href: "/#harga", label: "Harga" },
  { href: "/#faq", label: "Tanya Jawab" },
  { href: "/#hubungi-kami", label: "Hubungi Kami" },
] as const;

const MASUK_CLASS =
  "rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition-all hover:shadow-md hover:shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500";

const DAFTAR_CLASS =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800";

export function PublicHeader({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);
  const [loginMenuOpen, setLoginMenuOpen] = useState(false);
  const loginMenuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toggle buka/tutup saat tombol Masuk diklik
  function toggleLoginMenu(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setLoginMenuOpen((prev) => !prev);
  }

  // Hover handlers dengan toleransi waktu yang nyaman
  function handleMouseEnter() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setLoginMenuOpen(true);
  }

  function handleMouseLeave() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setLoginMenuOpen(false);
    }, 300);
  }

  // Tutup dropdown saat klik di luar atau tekan Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (loginMenuRef.current && !loginMenuRef.current.contains(event.target as Node)) {
        setLoginMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLoginMenuOpen(false);
      }
    }

    if (loginMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [loginMenuOpen]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  function linkClass(href: (typeof NAV_LINKS)[number]["href"]) {
    return href === active
      ? "whitespace-nowrap text-sm font-semibold text-indigo-600"
      : "whitespace-nowrap text-sm font-medium text-slate-600 transition-colors hover:text-indigo-600";
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

        <nav className="hidden items-center gap-5 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}

          {/* Tombol Masuk: Klik untuk toggle 4 pilihan portal masuk */}
          <div
            ref={loginMenuRef}
            className="relative"
            // Hover hanya untuk mouse. Di layar sentuh satu ketukan memicu mouseenter (buka) lalu click (tutup),
            // sehingga menu tidak pernah terbuka; untuk sentuhan cukup klik sebagai toggle.
            onPointerEnter={(e) => { if (e.pointerType === "mouse") handleMouseEnter(); }}
            onPointerLeave={(e) => { if (e.pointerType === "mouse") handleMouseLeave(); }}
          >
            <button
              type="button"
              onClick={toggleLoginMenu}
              className={`${MASUK_CLASS} inline-flex items-center gap-2 cursor-pointer select-none`}
              aria-expanded={loginMenuOpen}
              aria-haspopup="menu"
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

            {/* Dropdown 4 Pilihan Portal Masuk */}
            {loginMenuOpen && (
              <div className="absolute right-0 top-full z-50 w-72 pt-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/5">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Pilih Portal Masuk
                  </div>

                  {/* 1. Siswa */}
                  <Link
                    href="/login"
                    onClick={() => setLoginMenuOpen(false)}
                    className="flex items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-indigo-50/70 group"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600">Siswa</span>
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">Utama</span>
                      </div>
                      <span className="text-xs text-slate-500">Mengerjakan try out &amp; rapor evaluasi</span>
                    </div>
                  </Link>

                  {/* 2. Mitra & Reseller */}
                  <Link
                    href="/mitra/login"
                    onClick={() => setLoginMenuOpen(false)}
                    className="flex items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-amber-50/70 group"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                      <Handshake className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 group-hover:text-amber-700">Mitra &amp; Reseller</span>
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">Portal</span>
                      </div>
                      <span className="text-xs text-slate-500">Beli &amp; kelola voucher siswa</span>
                    </div>
                  </Link>

                  {/* 3. Admin Sekolah */}
                  <Link
                    href="/admin/admin-sekolah"
                    onClick={() => setLoginMenuOpen(false)}
                    className="flex items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-emerald-50/70 group"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <School className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-700">Admin Sekolah</span>
                      <span className="block text-xs text-slate-500">Kelola rombel &amp; siswa sekolah</span>
                    </div>
                  </Link>

                  {/* 4. Dinas Pendidikan */}
                  <Link
                    href="/admin/dinas-pendidikan"
                    onClick={() => setLoginMenuOpen(false)}
                    className="flex items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-sky-50/70 group"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-900 group-hover:text-sky-700">Dinas Pendidikan</span>
                      <span className="block text-xs text-slate-500">Pantau kesiapan wilayah</span>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link href="/registrasi" className={DAFTAR_CLASS}>
            Daftar
          </Link>
        </nav>

        {/* Header Mobile */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link href="/registrasi" className={DAFTAR_CLASS}>
            Daftar
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
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

      {/* Menu Navigasi Mobile (Lengkap 4 Pilihan Portal Masuk) */}
      {open && (
        <nav className="mx-auto mt-3 flex max-w-6xl flex-col gap-1 border-t border-slate-100 pt-3 lg:hidden">
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
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Pilihan Portal Masuk
          </div>
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <GraduationCap className="h-4 w-4 text-indigo-600" />
            <span>Masuk sebagai Siswa</span>
          </Link>
          <Link
            href="/mitra/login"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg bg-indigo-50/70 px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100/70"
          >
            <Handshake className="h-4 w-4 text-amber-600" />
            <span>Masuk sebagai Mitra &amp; Reseller</span>
          </Link>
          <Link
            href="/admin/admin-sekolah"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <School className="h-4 w-4 text-emerald-600" />
            <span>Masuk sebagai Admin Sekolah</span>
          </Link>
          <Link
            href="/admin/dinas-pendidikan"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Building2 className="h-4 w-4 text-sky-600" />
            <span>Masuk sebagai Dinas Pendidikan</span>
          </Link>
        </nav>
      )}
    </header>
  );
}
