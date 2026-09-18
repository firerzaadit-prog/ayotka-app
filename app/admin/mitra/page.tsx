import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { LoginForm } from "@/components/auth/login-form";

export default function MitraLoginPage() {
  return (
    <>
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
        eyebrow="Mitra AyoTKA"
        bannerTitle="Pantau voucher yang sudah kamu bagikan"
        bannerSubtitle="Lihat berapa banyak kode voucher dari batchmu yang sudah dipakai siswa - tanpa melihat identitas siswanya."
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
          <h1 className="text-2xl font-bold text-slate-900">Portal Mitra</h1>
          <p className="mt-1 text-sm text-slate-500">
            Masuk ke portal mitra untuk membeli voucher dan memantau kode akses siswa.
          </p>
        </div>

        <LoginForm identifierLabel="Email" identifierAutoComplete="username" expectedRole="mitra" />

        <div className="mt-6 flex flex-col items-center gap-2">
          <Link
            href="/forgot-password?portal=mitra"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            Lupa password akun mitra? Atur ulang di sini
          </Link>
          <p className="text-sm text-slate-500">
            Belum punya akun mitra?{" "}
            <Link
              href="/registrasi/mitra"
              className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Daftar sebagai mitra
            </Link>
          </p>
        </div>
      </AuthSplitLayout>
    </>
  );
}
