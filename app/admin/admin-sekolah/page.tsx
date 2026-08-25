import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { LoginForm } from "@/components/auth/login-form";

export default function AdminSekolahLoginPage() {
  return (
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
