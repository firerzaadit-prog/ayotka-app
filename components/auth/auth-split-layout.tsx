import Link from "next/link";
import type { ReactNode } from "react";
import Image from "next/image";

type Accent = "siswa" | "admin_sekolah" | "admin_pusat" | "dinas_pendidikan";

const ACCENT_GRADIENT: Record<Accent, string> = {
  siswa: "from-indigo-600 via-violet-600 to-violet-500",
  admin_sekolah: "from-sky-600 via-cyan-600 to-cyan-500",
  admin_pusat: "from-slate-800 via-indigo-800 to-violet-700",
  dinas_pendidikan: "from-emerald-700 via-teal-700 to-cyan-700",
};

/**
 * Layout dua kolom untuk seluruh halaman auth (login siswa, login admin
 * sekolah/pusat, registrasi, lupa password) - form di kiri, panel gradien
 * dekoratif di kanan (disembunyikan di layar sempit). Warna gradien beda
 * per peran (accent) supaya ketiga pintu masuk terasa beda tanpa keluar
 * dari satu palet yang sama.
 */
export function AuthSplitLayout({
  accent = "siswa",
  eyebrow,
  bannerTitle,
  bannerSubtitle,
  bannerIcon,
  children,
}: {
  accent?: Accent;
  eyebrow: string;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerIcon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-white">
      <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 lg:w-[46%] lg:px-16 xl:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900"
          >
            <div className="relative h-10 w-10 shrink-0">
              <Image
                src="/logo.png"
                alt="AyoTKA Logo"
                fill
                className="object-contain"
              />
            </div>
            AyoTKA
          </Link>
          {children}
        </div>
      </div>

      <div
        className={`relative hidden overflow-hidden bg-gradient-to-br lg:flex lg:w-[54%] lg:flex-col lg:justify-between ${ACCENT_GRADIENT[accent]} px-14 py-14 text-white`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 0, transparent 45%), radial-gradient(circle at 85% 75%, white 0, transparent 40%)",
          }}
        />
        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/70">{eyebrow}</p>
        </div>
        <div className="relative max-w-md">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            {bannerIcon}
          </div>
          <h2 className="text-3xl font-bold leading-tight text-balance">{bannerTitle}</h2>
          <p className="mt-4 text-base leading-relaxed text-white/80">{bannerSubtitle}</p>
        </div>
        <div className="relative text-xs text-white/50">
          &copy; {new Date().getFullYear()} AyoTKA — Tes Kemampuan Akademik
        </div>
      </div>
    </div>
  );
}
