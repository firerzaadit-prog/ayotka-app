import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ReloadButton } from "@/components/maintenance/reload-button";

export const metadata: Metadata = {
  title: "Sedang Dalam Pemeliharaan Sistem | AyoTKA",
  description: "AyoTKA sedang dalam pemeliharaan berkala untuk peningkatan performa dan kenyamanan asesmen Anda.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MaintenancePage() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-between bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 text-slate-100 px-4 py-10 sm:py-16 overflow-hidden">
      {/* Background glowing gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header with Logo */}
      <header className="relative z-10 flex items-center gap-3">
        <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/15 shadow-lg p-2">
          <Image
            src="/logo-mark.png"
            alt="AyoTKA"
            width={40}
            height={40}
            className="object-contain"
            priority
          />
        </div>
        <div>
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-1.5">
            Ayo<span className="text-indigo-400">TKA</span>
          </span>
          <p className="text-[11px] sm:text-xs text-slate-400 tracking-wider uppercase font-medium">
            Platform Tes Kemampuan Akademik
          </p>
        </div>
      </header>

      {/* Main Content Card */}
      <div className="relative z-10 max-w-2xl w-full my-auto text-center flex flex-col items-center pt-8 pb-10">
        {/* Status Pill Badge */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs sm:text-sm font-medium mb-6 backdrop-blur-md shadow-inner">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          <span>Pemeliharaan Sistem Sedang Berlangsung</span>
        </div>

        {/* Animated Icon Illustration */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-indigo-600/30 via-purple-500/20 to-indigo-400/10 border border-white/15 flex items-center justify-center backdrop-blur-xl shadow-2xl">
            <svg
              className="w-12 h-12 sm:w-14 sm:h-14 text-indigo-300 animate-[spin_12s_linear_infinite]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
        </div>

        {/* Heading & Subtitles */}
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mt-4">
          Kami Sedang Meningkatkan Performa Sistem
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-lg mt-3 leading-relaxed">
          Platform AyoTKA sedang dalam proses pemeliharaan berkala dan optimalisasi server demi kelancaran dan akurasi asesmen belajar seluruh siswa.
        </p>

        {/* 3 Status Points */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl mt-8 text-left">
          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold mb-2">
              ✓
            </div>
            <p className="text-xs font-semibold text-white">Data Aman 100%</p>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Akun, riwayat pengerjaan, dan nilai ujian tersimpan dengan aman di database.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold mb-2">
              ⚡
            </div>
            <p className="text-xs font-semibold text-white">Kapasitas Server</p>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Peningkatan kapasitas agar ribuan siswa dapat ujian serentak tanpa kendala.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-bold mb-2">
              ✨
            </div>
            <p className="text-xs font-semibold text-white">Learning Analytics AI</p>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Pembaruan mesin AI analisis kekuatan, kelemahan, dan rekomendasi belajar.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <ReloadButton />

          <Link
            href="https://wa.me/6281234567890?text=Halo%20Admin%20AyoTKA,%20saya%20ingin%20menanyakan%20status%20pemeliharaan%20sistem"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 text-slate-200 text-xs sm:text-sm font-medium border border-white/10 backdrop-blur-sm transition-all"
          >
            Hubungi Bantuan
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center text-xs text-slate-500 pt-6">
        <p>© {new Date().getFullYear()} AyoTKA. Seluruh hak cipta dilindungi undang-undang.</p>
      </footer>
    </main>
  );
}
