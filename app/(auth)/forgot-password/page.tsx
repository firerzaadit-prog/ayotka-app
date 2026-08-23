"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/confirm?next=/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError("Gagal mengirim email. Coba lagi beberapa saat lagi.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Cek email kamu</h1>
        <p className="text-sm text-slate-600">
          Kalau {email} terdaftar, kami sudah mengirim link untuk atur ulang
          password. Link berlaku sementara waktu.
        </p>
        <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">
          Kembali ke halaman masuk
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Lupa password</h1>
        <p className="text-sm text-slate-500">
          Masukkan email akunmu, kami kirim link untuk atur ulang password.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Mengirim..." : "Kirim link reset"}
      </Button>

      <Link href="/login" className="text-center text-sm text-slate-500 hover:text-slate-700">
        Kembali ke halaman masuk
      </Link>
    </form>
  );
}
