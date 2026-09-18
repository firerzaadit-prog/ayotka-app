"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type PortalConfig = {
  label: string;
  loginUrl: string;
  loginTitle: string;
};

const PORTAL_CONFIGS: Record<string, PortalConfig> = {
  mitra: {
    label: "Mitra AyoTKA",
    loginUrl: "/admin/mitra",
    loginTitle: "Login Portal Mitra",
  },
  admin_sekolah: {
    label: "Admin Sekolah",
    loginUrl: "/admin/admin-sekolah",
    loginTitle: "Login Admin Sekolah",
  },
  dinas_pendidikan: {
    label: "Dinas Pendidikan",
    loginUrl: "/admin/dinas-pendidikan",
    loginTitle: "Login Dinas Pendidikan",
  },
  admin_pusat: {
    label: "Admin Pusat",
    loginUrl: "/admin/admin-pusat",
    loginTitle: "Login Admin Pusat",
  },
};

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const portalParam = searchParams.get("portal") ?? "";
  const portalConfig = PORTAL_CONFIGS[portalParam];

  const defaultLoginUrl = portalConfig?.loginUrl ?? "/login";
  const defaultLoginTitle = portalConfig?.loginTitle ?? "Halaman Masuk";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Gagal mengirim email reset password. Coba lagi.");
        return;
      }

      setMessage(data?.message ?? "Tautan reset password telah dikirim ke email Anda.");
      setSent(true);
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900">Periksa Email Anda</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {message ??
              `Kami sudah mengirimkan tautan konfirmasi untuk atur ulang password ke ${email}.`}
          </p>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs text-slate-600">
          <p className="font-medium text-indigo-950">Langkah selanjutnya:</p>
          <ol className="mt-1.5 list-inside list-decimal text-left space-y-1">
            <li>Buka email Anda dan periksa kotak masuk (atau folder spam/promosi).</li>
            <li>Klik tombol <strong>&quot;Atur Ulang Password&quot;</strong> di dalam email tersebut.</li>
            <li>Anda akan diarahkan ke halaman pembuatan password baru.</li>
          </ol>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline"
          >
            Belum menerima email? Kirim ulang
          </button>
          <Link
            href={defaultLoginUrl}
            className="mt-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            &larr; Kembali ke {defaultLoginTitle}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        {portalConfig && (
          <span className="inline-block rounded-full bg-indigo-50 border border-indigo-200 px-3 py-0.5 text-xs font-semibold text-indigo-700 mb-2">
            Portal {portalConfig.label}
          </span>
        )}
        <h1 className="text-xl font-bold text-slate-900">
          Lupa Password{portalConfig ? ` ${portalConfig.label}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Masukkan alamat email yang terdaftar pada akun Anda. Kami akan mengirimkan tautan konfirmasi untuk mengatur ulang password.
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div>
        <Label htmlFor="email">Alamat Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nama@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Mengirim link..." : "Kirim Link Atur Ulang Password"}
      </Button>

      <Link
        href={defaultLoginUrl}
        className="text-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
      >
        &larr; Kembali ke {defaultLoginTitle}
      </Link>
    </form>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-full" />
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
