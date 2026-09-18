import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { LoginForm } from "@/components/auth/login-form";

export default function AdminSekolahLoginPage() {
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
        accent="admin_sekolah"
        eyebrow="Admin Sekolah"
        bannerTitle="Kelola siswa dan pantau hasil TKA sekolahmu"
        bannerSubtitle="Tambah siswa, atur jadwal ujian, kelola kelas, dan lihat laporan performa sekolahmu dalam satu tempat."
        bannerIcon={
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-white">
            <path
              d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M7 11.5v4c0 1.38 2.24 2.5 5 2.5s5-1.12 5-2.5v-4M20 9.5v6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Portal Admin Sekolah</h1>
          <p className="mt-1 text-sm text-slate-500">Masuk dengan akun admin sekolah kamu.</p>
        </div>

        <LoginForm identifierLabel="Email" identifierAutoComplete="username" expectedRole="admin_sekolah" />

        <div className="mt-6 text-center">
          <Link
            href="/forgot-password?portal=admin_sekolah"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            Lupa password akun admin sekolah? Atur ulang di sini
          </Link>
        </div>
      </AuthSplitLayout>
    </>
  );
}
