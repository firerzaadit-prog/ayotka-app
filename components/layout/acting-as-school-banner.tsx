"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Strip mencolok di mode "Kelola Sekolah" - selalu terlihat supaya admin pusat tidak lupa sekolah mana yang sedang dikelola. */
export function ActingAsSchoolBanner({ schoolName }: { schoolName: string }) {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  async function handleExit() {
    setExiting(true);
    await fetch("/api/admin-pusat/act-as-school", { method: "DELETE" });
    router.push("/admin-pusat/sekolah");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950 sm:px-6">
      <span>
        Mode Kelola Sekolah — Anda mengelola <strong>{schoolName}</strong> sebagai Admin Pusat.
        Semua aksi tercatat di audit log.
      </span>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="shrink-0 rounded-lg border border-amber-950/25 px-3 py-1 font-semibold text-amber-950 transition-colors hover:bg-amber-950/10 disabled:opacity-60"
      >
        {exiting ? "Keluar..." : "Keluar dari mode ini"}
      </button>
    </div>
  );
}
