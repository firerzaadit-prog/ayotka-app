"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Tahap = "siap" | "memproses" | "berhasil" | "sudah" | "galat";

/**
 * Halaman tujuan tautan di email verifikasi email kontak (akun NISN). Tidak butuh login: pemilik email sering membuka
 * tautan di perangkat lain. Verifikasi baru terjadi setelah tombol ditekan (bukan otomatis saat halaman terbuka),
 * supaya pemindai tautan di kotak surat tidak memverifikasi alamat tanpa sepengetahuan pemiliknya.
 */
function VerifikasiContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [tahap, setTahap] = useState<Tahap>(token ? "siap" : "galat");
  const [pesan, setPesan] = useState<string | null>(token ? null : "Tautan verifikasi tidak lengkap. Buka lagi tautan dari email, atau minta tautan baru lewat halaman Profil.");

  async function verifikasi() {
    if (tahap === "memproses") return;
    setTahap("memproses");
    setPesan(null);
    try {
      const res = await fetch("/api/auth/verifikasi-email-kontak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; sudahTerverifikasi?: boolean; error?: string } | null;
      if (res.ok && data?.ok) {
        setTahap(data.sudahTerverifikasi ? "sudah" : "berhasil");
        return;
      }
      setPesan(data?.error ?? "Verifikasi gagal. Coba lagi.");
      setTahap("galat");
    } catch {
      setPesan("Tidak dapat terhubung ke server. Periksa koneksi internetmu lalu coba lagi.");
      setTahap("galat");
    }
  }

  if (tahap === "berhasil" || tahap === "sudah") {
    return (
      <div className="flex flex-col gap-4 text-center" data-hasil-verifikasi="berhasil">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{tahap === "sudah" ? "Email kontak sudah terverifikasi" : "Email kontak terverifikasi"}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Mulai sekarang alamat ini dipakai untuk atur ulang password lewat NISN dan bukti pembayaran. Cara masukmu tidak berubah: tetap memakai NISN dan password.
          </p>
        </div>
        <Link href="/login" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          Ke halaman masuk &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Verifikasi email kontak</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Tekan tombol di bawah untuk memastikan alamat email ini benar milikmu. Setelah itu alamat ini dipakai untuk atur ulang password lewat NISN dan bukti pembayaran akun AyoTKA.
        </p>
      </div>

      {tahap === "galat" && pesan && (
        <Alert variant="danger" role="alert" data-hasil-verifikasi="galat">
          {pesan}
        </Alert>
      )}

      {token ? (
        <Button type="button" onClick={verifikasi} disabled={tahap === "memproses"} className="w-full">
          {tahap === "memproses" ? "Memverifikasi..." : tahap === "galat" ? "Coba verifikasi lagi" : "Verifikasi email kontak"}
        </Button>
      ) : null}

      <Link href="/login" className="text-center text-sm font-medium text-slate-500 transition-colors hover:text-slate-800">
        &larr; Kembali ke halaman masuk
      </Link>
    </div>
  );
}

export default function VerifikasiEmailKontakPage() {
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
      <VerifikasiContent />
    </Suspense>
  );
}
