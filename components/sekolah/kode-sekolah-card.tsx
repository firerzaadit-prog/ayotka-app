"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Kode Sekolah untuk admin sekolah (dulu hanya terlihat admin pusat dan di kartu klaim PDF). Siswa Jalur A memasukkan
 * kode ini di halaman registrasi, lalu mencari namanya dan memasukkan Kode Klaim pribadinya - lihat
 * app/(auth)/registrasi/sekolah/page.tsx. Dipakai di dashboard dan halaman Kelola Siswa.
 */
export function KodeSekolahCard({ kodeSekolah }: { kodeSekolah: string }) {
  const [tersalin, setTersalin] = useState(false);

  async function salin() {
    try {
      await navigator.clipboard.writeText(kodeSekolah);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      // Clipboard API tidak tersedia - kode tetap terlihat untuk disalin manual.
    }
  }

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-slate-500">Kode Sekolah</p>
        <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-slate-500">
          Bagikan kode ini ke siswa untuk mendaftar lewat Jalur A di ayotka.id/registrasi. Setiap siswa juga memerlukan
          Kode Klaim pribadinya (cetak kartu klaim dari halaman Kelola Siswa).
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          data-testid="kode-sekolah"
          className="rounded-md bg-slate-100 px-3 py-1.5 font-mono text-base font-bold tracking-wider text-slate-900"
        >
          {kodeSekolah}
        </span>
        <Button variant="secondary" onClick={salin}>
          {tersalin ? "Disalin!" : "Salin kode"}
        </Button>
      </div>
    </Card>
  );
}
