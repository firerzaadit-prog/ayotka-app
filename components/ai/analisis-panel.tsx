"use client";

import { useEffect, useRef, useState } from "react";

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
  | { status: "ready"; analysis: AnalisisAi; generatedAt: string }
  | { status: "error"; error: string };

const POLL_MS = 5000;
const MAX_POLLS = 24; // ~2 menit (10s + 20s + 40s backoff internal + overhead)

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

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/attempts/${attemptId}/analisis-ai`);
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

  async function handleTrigger() {
    pollCountRef.current = 0;
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

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Analisis AI</h3>
        {canTrigger && (data.status === "none" || data.status === "error") && (
          <button
            onClick={handleTrigger}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
          >
            Mulai Analisis AI
          </button>
        )}
        {canTrigger && data.status === "ready" && (
          <button
            onClick={handleTrigger}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Analisis ulang
          </button>
        )}
      </div>

      {data.status === "none" && (
        <p className="text-sm text-slate-500">
          {canTrigger ? "Belum dianalisis - klik tombol untuk mulai." : "Belum ada analisis untuk hasil ini."}
        </p>
      )}
      {data.status === "processing" && (
        <p className="text-sm text-slate-500">Sedang diproses, biasanya beberapa detik sampai satu menit...</p>
      )}
      {data.status === "error" && <p className="text-sm text-red-700">{data.error}</p>}
      {data.status === "ready" && (
        <div className="flex flex-col gap-3 text-sm">
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
    </div>
  );
}
