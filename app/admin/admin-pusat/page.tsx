import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { LoginForm } from "@/components/auth/login-form";

export default function AdminPusatLoginPage() {
  return (
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

      <LoginForm identifierLabel="Email" identifierAutoComplete="username" />

      <p className="mt-6 text-center text-sm text-slate-500">
        Lupa password?{" "}
        <Link href="/forgot-password" className="font-medium text-slate-700 hover:text-slate-900">
          Atur ulang di sini
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
