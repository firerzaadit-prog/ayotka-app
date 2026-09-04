import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { LoginForm } from "@/components/auth/login-form";

export default function DinasPendidikanLoginPage() {
  return (
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
