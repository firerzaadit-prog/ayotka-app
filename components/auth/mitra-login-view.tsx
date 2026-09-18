import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { LoginForm } from "@/components/auth/login-form";

export function MitraLoginView() {
  return (
    <>
      {/* Tombol Beranda */}
      <Link
        href="/"
        className="group fixed left-5 top-5 z-50 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/40 active:scale-95"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Beranda
      </Link>

      <AuthSplitLayout
        accent="mitra"
        eyebrow="Mitra & Reseller AyoTKA"
        bannerTitle="Portal Mandiri Mitra & Reseller AyoTKA"
        bannerSubtitle="Beli paket voucher dengan diskon grosir bertingkat (hingga 30%), pantau kode akses yang telah digunakan siswa, dan kelola kemitraanmu secara instan."
        bannerIcon={
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-white">
            <path
              d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M10 7v10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" strokeLinecap="round" />
          </svg>
        }
      >
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/80 px-3 py-1 text-xs font-semibold text-indigo-700 mb-3">
            <span>PORTAL MITRA RESELLER</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Masuk Akun Mitra</h1>
          <p className="mt-1 text-sm text-slate-500">
            Masuk dengan email dan password akun mitra AyoTKA kamu.
          </p>
        </div>

        <LoginForm identifierLabel="Email Akun Mitra" identifierAutoComplete="username" expectedRole="mitra" />

        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href="/forgot-password?portal=mitra"
            className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
          >
            Lupa password akun mitra? Atur ulang di sini
          </Link>
          <div className="h-px w-full bg-slate-100" />
          <p className="text-sm text-slate-600">
            Belum punya akun mitra?{" "}
            <Link
              href="/registrasi/mitra"
              className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Daftar sebagai Mitra Baru
            </Link>
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Bukan mitra?</span>
            <Link href="/login" className="hover:text-slate-600 underline">
              Masuk sebagai Siswa
            </Link>
            <span>•</span>
            <Link href="/admin/admin-sekolah" className="hover:text-slate-600 underline">
              Admin Sekolah
            </Link>
          </div>
        </div>
      </AuthSplitLayout>
    </>
  );
}
