"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";

/**
 * Form login yang dipakai bersama oleh siswa, admin sekolah, dan admin
 * pusat - ketiganya submit ke endpoint yang sama (role-agnostic, ditentukan
 * dari app_metadata di server) dan cuma beda label field & auto-complete.
 */
export function LoginForm({
  identifierLabel,
  identifierAutoComplete = "username",
}: {
  identifierLabel: string;
  identifierAutoComplete?: string;
}) {
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
      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div>
        <Label htmlFor="emailOrNisn">{identifierLabel}</Label>
        <Input
          id="emailOrNisn"
          type="text"
          autoComplete={identifierAutoComplete}
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
    </form>
  );
}
