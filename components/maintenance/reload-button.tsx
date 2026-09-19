"use client";

import { useState } from "react";

export function ReloadButton() {
  const [loading, setLoading] = useState(false);

  const handleReload = () => {
    setLoading(true);
    // Arahkan kembali ke halaman utama / untuk mengecek apakah maintenance sudah selesai
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/?t=${Date.now()}`;
  };

  return (
    <button
      onClick={handleReload}
      type="button"
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-75 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
    >
      <svg
        className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      {loading ? "Memeriksa Status..." : "Muat Ulang Halaman"}
    </button>
  );
}
