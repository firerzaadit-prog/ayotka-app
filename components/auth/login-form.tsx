"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { KirimUlangKonfirmasi } from "@/components/auth/kirim-ulang-konfirmasi";

/**
 * Form login yang dipakai bersama oleh siswa, admin sekolah, dan admin
 * pusat - ketiganya submit ke endpoint yang sama (role-agnostic, ditentukan
 * dari app_metadata di server) dan cuma beda label field & auto-complete.
 *
 * `expectedRole` dipakai untuk memvalidasi di server bahwa role akun yang
 * login memang sesuai dengan portal halaman ini - mencegah, misalnya, admin
 * pusat login lewat halaman siswa (lihat app/api/auth/login/route.ts).
 */
export function LoginForm({
  identifierLabel,
  identifierAutoComplete = "username",
  expectedRole,
  showForgotPassword = true,
}: {
  identifierLabel: string;
  identifierAutoComplete?: string;
  expectedRole?: "siswa" | "admin_sekolah" | "admin_pusat" | "dinas_pendidikan" | "mitra";
  showForgotPassword?: boolean;
}) {
  const router = useRouter();
  const [emailOrNisn, setEmailOrNisn] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [belumKonfirmasi, setBelumKonfirmasi] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBelumKonfirmasi(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrNisn, password, portal: expectedRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Gagal masuk. Coba lagi.");
        setBelumKonfirmasi(data.code === "EMAIL_BELUM_DIKONFIRMASI");
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
      {belumKonfirmasi && emailOrNisn.includes("@") && (
        <KirimUlangKonfirmasi email={emailOrNisn.trim()} />
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
        <div className="flex items-center justify-between mb-1.5">
          <Label htmlFor="password" className="mb-0">
            Password
          </Label>
          {showForgotPassword && (
            <Link
              href={expectedRole ? `/forgot-password?portal=${expectedRole}` : "/forgot-password"}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
            >
              Lupa password?
            </Link>
          )}
        </div>
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
