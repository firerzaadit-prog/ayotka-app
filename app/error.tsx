"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Terjadi kesalahan</h1>
      <p className="max-w-md text-sm text-slate-600">
        Maaf, ada yang tidak berjalan semestinya. Coba muat ulang halaman ini.
        Kalau kamu sedang mengerjakan ujian, jawabanmu yang sudah tersimpan
        aman dan tidak hilang.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Coba lagi
      </button>
    </div>
  );
}
