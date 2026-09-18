import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { LoginForm } from "@/components/auth/login-form";

export default function AdminPusatLoginPage() {
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
        accent="admin_pusat"
        eyebrow="Admin Pusat"
        bannerTitle="Kelola seluruh jaringan sekolah dari satu dasbor"
        bannerSubtitle="Pantau hasil TKA, kelola sekolah & admin, atur langganan, dan lihat analitik nasional secara real-time."
        bannerIcon={
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-white">
            <path
              d="M12 3 4 6.5v5c0 4.6 3.2 8.7 8 9.9 4.8-1.2 8-5.3 8-9.9v-5L12 3Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="m9 12 2 2 4-4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Portal Admin Pusat</h1>
          <p className="mt-1 text-sm text-slate-500">Masuk dengan akun admin pusat AyoTKA kamu.</p>
        </div>

        <LoginForm identifierLabel="Email" identifierAutoComplete="username" expectedRole="admin_pusat" />

        <div className="mt-6 text-center">
          <Link
            href="/forgot-password?portal=admin_pusat"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            Lupa password akun admin pusat? Atur ulang di sini
          </Link>
        </div>
      </AuthSplitLayout>
    </>
  );
}
