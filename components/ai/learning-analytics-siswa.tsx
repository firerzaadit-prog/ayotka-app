"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnalisisAiPanel } from "@/components/ai/analisis-panel";
import { LaSusulanCard } from "@/components/ai/la-susulan-card";
import type { OpsiLaSusulan } from "@/lib/billing/learning-analytics";

/**
 * Bagian Learning Analytics di halaman hasil siswa. Bergantian antara:
 * - kartu "Lakukan Learning Analytics" (percobaan tanpa analisis yang masih bisa dijalankan susulan), dan
 * - panel status/hasil analisis (sedang diproses, antre, selesai).
 * Kalau analisis yang baru dipesan ternyata tidak jadi (gagal dan saldo dikembalikan, atau terlewat), siswa dikembalikan
 * ke kartu dengan pesan dan angka terbaru, bukan dibiarkan menatap pesan "hubungi admin".
 */
export function LearningAnalyticsSiswa({
  attemptId,
  laSusulan,
  onAnalisisSiap,
}: {
  attemptId: string;
  laSusulan: OpsiLaSusulan | null;
  /** Dipanggil setiap kali panel melaporkan hasil analisis sudah ada (halaman memakainya untuk mengaktifkan Tanya Tutor AI). */
  onAnalisisSiap?: () => void;
}) {
  const [opsi, setOpsi] = useState<OpsiLaSusulan | null>(laSusulan);
  const [fase, setFase] = useState<"kartu" | "panel">(laSusulan?.tersedia ? "kartu" : "panel");
  const [catatan, setCatatan] = useState<string | null>(null);
  // true hanya setelah siswa menekan tombol di sesi halaman ini: status "none"/"error" sebelum itu bukan kegagalan pesanan.
  const dipesanRef = useRef(false);
  // Ref supaya callback yang berubah tiap render tidak mengubah saatStatus (yang diteruskan ke panel).
  const onAnalisisSiapRef = useRef(onAnalisisSiap);
  useEffect(() => {
    onAnalisisSiapRef.current = onAnalisisSiap;
  }, [onAnalisisSiap]);

  const muatOpsi = useCallback(async (): Promise<OpsiLaSusulan | null> => {
    try {
      const res = await fetch(`/api/siswa/attempts/${attemptId}/learning-analytics`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      return res.ok && json?.opsi ? (json.opsi as OpsiLaSusulan) : null;
    } catch {
      return null;
    }
  }, [attemptId]);

  const segarkan = useCallback(async () => {
    const baru = await muatOpsi();
    if (baru) setOpsi(baru);
  }, [muatOpsi]);

  // Siswa mengisi saldo di tab/halaman lain lalu kembali: angka saldo dan tombol ikut diperbarui.
  useEffect(() => {
    if (fase !== "kartu") return;
    function saatAktif() {
      if (document.visibilityState === "visible") void segarkan();
    }
    document.addEventListener("visibilitychange", saatAktif);
    window.addEventListener("focus", saatAktif);
    return () => {
      document.removeEventListener("visibilitychange", saatAktif);
      window.removeEventListener("focus", saatAktif);
    };
  }, [fase, segarkan]);

  const saatDipesan = useCallback(() => {
    dipesanRef.current = true;
    setCatatan(null);
    setFase("panel");
  }, []);

  const saatStatus = useCallback(
    async (status: "none" | "queued" | "processing" | "ready" | "error") => {
      if (status === "ready") onAnalisisSiapRef.current?.();
      if (!dipesanRef.current) return;
      if (status !== "none" && status !== "error") return;
      dipesanRef.current = false;
      const baru = await muatOpsi();
      if (baru?.tersedia) {
        setOpsi(baru);
        setCatatan(
          status === "error"
            ? "Analisis belum berhasil diproses. Saldo atau jatah yang dipakai sudah dikembalikan, kamu bisa mencobanya lagi."
            : "Analisis belum bisa dijalankan. Periksa saldo atau jatahmu, lalu coba lagi.",
        );
        setFase("kartu");
      }
    },
    [muatOpsi],
  );

  if (fase === "kartu" && opsi?.tersedia) {
    return <LaSusulanCard attemptId={attemptId} opsi={opsi} catatan={catatan} onMulai={saatDipesan} onSegarkan={segarkan} />;
  }
  return <AnalisisAiPanel attemptId={attemptId} canTrigger={false} onStatus={saatStatus} />;
}
