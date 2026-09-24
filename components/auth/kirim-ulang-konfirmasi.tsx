"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Tombol "Kirim ulang email konfirmasi" - dipakai di layar setelah daftar
 * (saat email awal gagal/belum sampai) dan di form login (akun belum
 * terkonfirmasi). Memanggil /api/auth/kirim-ulang-konfirmasi yang dibatasi
 * per IP & per email di server, jadi di sini cukup jeda pendek supaya tidak
 * ditekan berulang-ulang beruntun.
 */
export function KirimUlangKonfirmasi({ email }: { email: string }) {
  const [status, setStatus] = useState<"diam" | "mengirim" | "berhasil" | "gagal">("diam");
  const [pesan, setPesan] = useState<string | null>(null);

  async function handleKirimUlang() {
    setStatus("mengirim");
    setPesan(null);
    const res = await fetch("/api/auth/kirim-ulang-konfirmasi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);

    if (res?.ok) {
      setStatus("berhasil");
      setPesan(data?.message ?? "Email konfirmasi baru sudah dikirim. Cek kotak masuk dan folder spam.");
      return;
    }
    setStatus("gagal");
    setPesan(data?.error ?? "Belum bisa mengirim ulang sekarang. Coba lagi beberapa saat lagi.");
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button type="button" variant="secondary" onClick={handleKirimUlang} disabled={status === "mengirim"}>
        {status === "mengirim" ? "Mengirim..." : "Kirim ulang email konfirmasi"}
      </Button>
      {pesan && (
        <p
          role="status"
          className={`text-sm ${status === "berhasil" ? "text-emerald-700" : "text-amber-700"}`}
        >
          {pesan}
        </p>
      )}
    </div>
  );
}
