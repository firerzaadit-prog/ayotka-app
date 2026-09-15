import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { LoginForm } from "@/components/auth/login-form";

export default function MitraLoginPage() {
  return (
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
        <p className="mt-1 text-sm text-slate-500">Masuk dengan akun yang diberikan Admin Pusat AyoTKA.</p>
      </div>

      <LoginForm identifierLabel="Email" identifierAutoComplete="username" expectedRole="mitra" />

      <p className="mt-6 text-center text-sm text-slate-500">
        Lupa password?{" "}
        <Link href="/forgot-password" className="font-medium text-slate-700 hover:text-slate-900">
          Atur ulang di sini
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
