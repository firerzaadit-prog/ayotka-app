import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { LoginForm } from "@/components/auth/login-form";

export default function DinasPendidikanLoginPage() {
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
        accent="dinas_pendidikan"
        eyebrow="Dinas Pendidikan"
        bannerTitle="Pantau kesiapan TKA sekolah-sekolah di wilayahmu"
        bannerSubtitle="Lihat persentase kesiapan siswa menghadapi Tes Kemampuan Akademik di setiap sekolah, akses baca saja."
        bannerIcon={
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-white">
            <path
              d="M4 21V8l8-4 8 4v13M4 21h16M9 21v-6h6v6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Portal Dinas Pendidikan</h1>
          <p className="mt-1 text-sm text-slate-500">Masuk dengan akun yang diberikan Admin Pusat AyoTKA.</p>
        </div>

        <LoginForm identifierLabel="Email" identifierAutoComplete="username" expectedRole="dinas_pendidikan" />

        <div className="mt-6 text-center">
          <Link
            href="/forgot-password?portal=dinas_pendidikan"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            Lupa password akun dinas pendidikan? Atur ulang di sini
          </Link>
        </div>
      </AuthSplitLayout>
    </>
  );
}
