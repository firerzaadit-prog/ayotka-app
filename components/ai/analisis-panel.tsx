"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type AnalisisAi = {
  ringkasan: string;
  petaKompetensi: { kode: string; narasi: string }[];
  levelKognitif: string;
  polaKesalahan: string;
  rekomendasi: string[];
};

type StatusResponse =
  | { status: "none" }
  | { status: "processing" }
  | { status: "ready"; analysis: AnalisisAi; generatedAt: string; outdated: boolean }
  | { status: "error"; error: string };

const POLL_MS = 5000;
const MAX_POLLS = 24; // ~2 menit (10s + 20s + 40s backoff internal + overhead)

/**
 * Ditampilkan bergantian selama status "processing" - progres asli tidak
 * diketahui (waktu respons Gemini bervariasi), jadi sengaja bukan progress
 * bar persentase, tapi teks yang berganti supaya siswa/admin tahu sistem
 * masih bekerja. Pesan terakhir (di luar array ini) jadi pesan menetap
 * untuk penantian yang lebih lama - lihat processingMessage di bawah.
 */
const PROCESSING_MESSAGES = [
  "Membaca jawabanmu...",
  "Menganalisis pola kompetensi...",
  "Menyusun rekomendasi belajar...",
];
const PROCESSING_MESSAGE_LONG_WAIT = "Masih diproses, hasil akan muncul otomatis di halaman ini...";
const PROCESSING_MESSAGE_INTERVAL_MS = 3500;

const FORMAT_TANGGAL = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Tiket 5.3-5.5: dipakai dua tempat - halaman monitoring admin sekolah
 * (canTrigger=true, ada tombol) dan halaman hasil siswa (canTrigger=false,
 * cuma menampilkan kalau sudah ada). Sengaja polling sederhana (lewat
 * pollTick, bukan panggil fetch langsung di body effect) supaya tidak
 * memicu cascading setState dari dalam effect - bukan websocket/SSE,
 * analisis cuma dipicu manual jadi jarang ada banyak proses bersamaan
 * untuk satu attempt.
 */
export function AnalisisAiPanel({ attemptId, canTrigger }: { attemptId: string; canTrigger: boolean }) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [pollTick, setPollTick] = useState(0);
  const pollCountRef = useRef(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/attempts/${attemptId}/analisis-ai`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (ignore) return;
      if (!res.ok) {
        setData({ status: "error", error: json?.error ?? "Gagal memuat status analisis." });
        return;
      }
      setData(json);
    })();
    return () => {
      ignore = true;
    };
  }, [attemptId, pollTick]);

  useEffect(() => {
    if (data?.status !== "processing") return;
    if (pollCountRef.current >= MAX_POLLS) return;
    const timer = setTimeout(() => {
      pollCountRef.current += 1;
      setPollTick((t) => t + 1);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [data]);

  // Ganti pesan reassurance secara berkala selagi masih "processing" - timer
  // terpisah dari siklus polling (POLL_MS) supaya perpindahan teksnya terasa
  // hidup, bukan cuma "melompat" tiap kali fetch status jalan. Reset ke
  // pesan pertama terjadi di handleTrigger (siklus baru dimulai dari sana),
  // bukan di effect ini, supaya tidak setState sinkron di badan effect.
  useEffect(() => {
    if (data?.status !== "processing") return;
    const timer = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, PROCESSING_MESSAGES.length));
    }, PROCESSING_MESSAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [data?.status]);

  // Kalau status sudah "ready", effect polling di atas berhenti - tab yang
  // sudah lama terbuka (mis. siswa buka halaman hasil sebelum admin klik
  // "Analisis ulang") tidak akan pernah tahu ada hasil baru tanpa ini.
  // Refetch tiap tab jadi aktif lagi supaya selalu sinkron dengan server.
  useEffect(() => {
    function refetchOnVisible() {
      if (document.visibilityState === "visible") {
        setPollTick((t) => t + 1);
      }
    }
    document.addEventListener("visibilitychange", refetchOnVisible);
    window.addEventListener("focus", refetchOnVisible);
    return () => {
      document.removeEventListener("visibilitychange", refetchOnVisible);
      window.removeEventListener("focus", refetchOnVisible);
    };
  }, []);

  async function handleTrigger() {
    pollCountRef.current = 0;
    setMessageIndex(0);
    setData({ status: "processing" });
    const res = await fetch(`/api/attempts/${attemptId}/analisis-ai`, { method: "POST" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setData({ status: "error", error: json?.error ?? "Gagal memulai analisis." });
      return;
    }
    setPollTick((t) => t + 1);
  }

  if (!data) return null;

  const processingMessage = PROCESSING_MESSAGES[messageIndex] ?? PROCESSING_MESSAGE_LONG_WAIT;

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Analisis AI</h3>
        {canTrigger && (data.status === "none" || data.status === "error") && (
          <Button onClick={handleTrigger} className="px-3 py-1.5 text-xs">
            Mulai Analisis AI
          </Button>
        )}
        {canTrigger && data.status === "ready" && (
          <button
            onClick={handleTrigger}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            Analisis ulang
          </button>
        )}
      </div>

      {data.status === "none" && (
        <p className="text-sm text-slate-500">
          {canTrigger
            ? "Belum dianalisis - klik tombol untuk mulai."
            : "Analisis AI belum dilakukan oleh admin pusat."}
        </p>
      )}
      {data.status === "processing" && (
        <div className="flex items-center gap-4 py-1">
          <div className="ai-processing-icon" aria-hidden="true">
            <div className="ai-processing-icon__glow" />
            <div className="ai-processing-icon__ring" />
            <div className="ai-processing-icon__core" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p key={processingMessage} className="ai-processing-message text-sm font-medium text-slate-700">
              {processingMessage}
            </p>
            <p className="text-xs text-slate-400">Biasanya beberapa detik sampai satu menit.</p>
          </div>
        </div>
      )}
      {data.status === "error" && (
        <Alert variant="danger">
          {canTrigger
            ? data.error
            : "Analisis AI belum berhasil diproses. Silakan hubungi admin pusat untuk memprosesnya kembali."}
        </Alert>
      )}
      {data.status === "ready" && (
        <div className="flex flex-col gap-3 text-sm">
          {data.outdated && (
            <Alert variant="warning">
              Hasil ini dibuat dengan versi analisis yang lebih lama.
              {canTrigger
                ? " Klik \"Analisis ulang\" untuk memperbarui dengan versi terbaru."
                : " Sebaiknya minta admin menjalankan \"Analisis ulang\" untuk hasil terbaru."}
            </Alert>
          )}
          <p className="text-xs text-slate-400">
            Dianalisis pada {FORMAT_TANGGAL.format(new Date(data.generatedAt))}
          </p>
          <p className="text-slate-700">{data.analysis.ringkasan}</p>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Peta Kompetensi</p>
            <ul className="flex flex-col gap-1">
              {data.analysis.petaKompetensi.map((k) => (
                <li key={k.kode} className="text-slate-600">
                  <span className="font-mono text-xs">{k.kode}</span> — {k.narasi}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Level Kognitif</p>
            <p className="text-slate-600">{data.analysis.levelKognitif}</p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Pola Kesalahan</p>
            <p className="text-slate-600">{data.analysis.polaKesalahan}</p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Rekomendasi Belajar</p>
            <ul className="list-disc pl-4 text-slate-600">
              {data.analysis.rekomendasi.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs italic text-slate-400">
            Analisis ini dibuat otomatis oleh AI sebagai alat bantu belajar, bukan penilaian final.
          </p>
        </div>
      )}
    </Card>
  );
}
