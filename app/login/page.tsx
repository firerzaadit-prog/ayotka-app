import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthSplitLayout
      accent="siswa"
      eyebrow="Tes Kemampuan Akademik"
      bannerTitle="Uji kemampuanmu, raih hasil terbaikmu"
      bannerSubtitle="Kerjakan TKA, lihat pembahasan lengkap tiap soal, dan pantau perkembangan belajarmu lewat analisis berbasis AI."
      bannerIcon={
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-white">
          <path
            d="M12 4.5 4 8l8 3.5L20 8l-8-3.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M7 10.25v4.5c0 1.24 2.24 2.25 5 2.25s5-1.01 5-2.25v-4.5M20 8v5.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Selamat datang kembali</h1>
        <p className="mt-1 text-sm text-slate-500">
          Masuk pakai email (atau NISN untuk siswa tanpa email) dan password akunmu.
        </p>
      </div>

      <LoginForm identifierLabel="Email atau NISN" />

      <div className="mt-6 flex flex-col items-center gap-2">
        <Link href="/forgot-password" className="text-sm text-slate-500 hover:text-slate-700">
          Lupa password?
        </Link>
        <p className="text-sm text-slate-500">
          Belum punya akun?{" "}
          <Link href="/registrasi" className="font-medium text-indigo-600 hover:text-indigo-700">
            Daftar
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
