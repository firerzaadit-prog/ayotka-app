"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [emailOrNisn, setEmailOrNisn] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrNisn, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Gagal masuk. Coba lagi.");
        return;
      }

      router.push(data.redirectTo ?? "/");
      router.refresh();
    } catch {
      setError("Tidak bisa terhubung ke server. Periksa koneksi internetmu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Masuk ke AyoTKA</h1>
        <p className="text-sm text-slate-500">Gunakan email (atau NISN untuk siswa tanpa email) dan password akunmu.</p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div>
        <Label htmlFor="emailOrNisn">Email atau NISN</Label>
        <Input
          id="emailOrNisn"
          type="text"
          autoComplete="username"
          required
          value={emailOrNisn}
          onChange={(e) => setEmailOrNisn(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FieldError />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Memproses..." : "Masuk"}
      </Button>

      <Link
        href="/forgot-password"
        className="text-center text-sm text-slate-500 hover:text-slate-700"
      >
        Lupa password?
      </Link>
      <Link
        href="/registrasi"
        className="text-center text-sm text-slate-500 hover:text-slate-700"
      >
        Belum punya akun? Daftar
      </Link>
    </form>
  );
}
