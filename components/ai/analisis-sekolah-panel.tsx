"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { type AnalisisAiSekolah } from "@/lib/ai/schema";

type StatusResponse =
  | { status: "none" }
  | { status: "processing" }
  | { status: "ready"; analysis: AnalisisAiSekolah; generatedAt: string; outdated: boolean }
  | { status: "error"; error: string };

const PROCESSING_MESSAGES = [
  "Menganalisis hasil daya serap...",
  "Membandingkan indikator...",
  "Menyusun rekomendasi tindak lanjut...",
];
const PROCESSING_MESSAGE_LONG_WAIT = "Masih diproses, hasil akan muncul otomatis...";
const PROCESSING_MESSAGE_INTERVAL_MS = 3500;

const FORMAT_TANGGAL = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function AnalisisAiSekolahPanel({
  kunci,
  queryString,
}: {
  kunci: string;
  queryString: string;
}) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setData(null);
      const res = await fetch(`/api/admin-sekolah/laporan-indikator/analisis-ai?kunci=${encodeURIComponent(kunci)}&${queryString}`, { cache: "no-store" });
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
  }, [kunci, queryString]);

  useEffect(() => {
    if (data?.status !== "processing") return;
    const timer = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, PROCESSING_MESSAGES.length));
    }, PROCESSING_MESSAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [data?.status]);

  async function handleTrigger() {
    setMessageIndex(0);
    setData({ status: "processing" });
    const res = await fetch(`/api/admin-sekolah/laporan-indikator/analisis-ai?kunci=${encodeURIComponent(kunci)}&${queryString}`, { method: "POST" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setData({ status: "error", error: json?.error ?? "Gagal memulai analisis." });
      return;
    }
    setData({
      status: "ready",
      analysis: json.analysis,
      generatedAt: new Date().toISOString(),
      outdated: false,
    });
  }

  if (!data) return null;

  const processingMessage = PROCESSING_MESSAGES[messageIndex] ?? PROCESSING_MESSAGE_LONG_WAIT;

  return (
    <Card className="border-indigo-100 bg-indigo-50/30">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Analisis Learning Analytics Sekolah</h3>
        {(data.status === "none" || data.status === "error") && (
          <Button onClick={handleTrigger} className="px-3 py-1.5 text-xs">
            Mulai Analisis
          </Button>
        )}
        {data.status === "ready" && (
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
          Belum dianalisis - klik tombol untuk mulai menganalisis daya serap secara otomatis dengan AI.
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
        <Alert variant="danger">{data.error}</Alert>
      )}
      {data.status === "ready" && (
        <div className="flex flex-col gap-3 text-sm">
          {data.outdated && (
            <Alert variant="warning">
              Hasil ini dibuat dengan versi analisis yang lebih lama. Klik &quot;Analisis ulang&quot; untuk memperbarui.
            </Alert>
          )}
          <p className="text-xs text-slate-400">
            Dianalisis pada {FORMAT_TANGGAL.format(new Date(data.generatedAt))}
          </p>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Ringkasan Performa Sekolah</p>
            <p className="text-slate-700">{data.analysis.ringkasan}</p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Kelebihan Sekolah</p>
            <p className="text-slate-600">{data.analysis.kelebihanSekolah}</p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Prioritas Perbaikan</p>
            <p className="text-slate-600">{data.analysis.kekuranganSekolah}</p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Rekomendasi Tindak Lanjut</p>
            <ul className="list-disc pl-4 text-slate-600">
              {data.analysis.rekomendasi.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
