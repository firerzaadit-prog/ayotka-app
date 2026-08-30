"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

function KonfirmasiContent() {
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tokenHash || !type) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Link tidak valid</h1>
        <p className="text-sm text-slate-600">
          Link ini tidak lengkap atau rusak. Minta link baru lewat halaman masuk.
        </p>
        <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">
          Kembali ke halaman masuk
        </Link>
      </div>
    );
  }

  const isRecovery = type === "recovery";

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token_hash: tokenHash, type }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setSubmitting(false);
      setError(data?.error ?? "Link sudah kedaluwarsa atau tidak valid. Minta link baru.");
      return;
    }

    window.location.href = next;
  }

  return (
    <div className="flex flex-col gap-4 text-center">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          {isRecovery ? "Atur ulang password" : "Konfirmasi email kamu"}
        </h1>
        <p className="text-sm text-slate-600">
          {isRecovery
            ? "Klik tombol di bawah untuk melanjutkan atur ulang password."
            : "Klik tombol di bawah untuk menyelesaikan verifikasi email pendaftaranmu."}
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Button onClick={handleConfirm} disabled={submitting} className="w-full">
        {submitting ? "Memproses..." : isRecovery ? "Lanjutkan" : "Konfirmasi email saya"}
      </Button>

      <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">
        Kembali ke halaman masuk
      </Link>
    </div>
  );
}

export default function KonfirmasiPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 text-center">
          <div>
            <Skeleton className="mx-auto h-5 w-48" />
            <Skeleton className="mx-auto mt-2 h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      }
    >
      <KonfirmasiContent />
    </Suspense>
  );
}
