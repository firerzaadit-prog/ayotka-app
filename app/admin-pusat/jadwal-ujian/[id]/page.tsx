"use client";

import { Fragment, use, useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { AnalisisAiPanel } from "@/components/ai/analisis-panel";

type AttemptRow = {
  id: string;
  studentNama: string;
  status: "berjalan" | "paused" | "selesai" | "kedaluwarsa";
  sisaDetik: number;
  skorAkhir: number | null;
  tabSwitchCount: number;
};

const STATUS_LABEL: Record<string, string> = {
  berjalan: "Sedang mengerjakan",
  paused: "Dijeda",
  selesai: "Selesai",
  kedaluwarsa: "Waktu habis",
};
const STATUS_CLASS: Record<string, string> = {
  berjalan: "bg-blue-100 text-blue-700",
  paused: "bg-amber-100 text-amber-700",
  selesai: "bg-green-100 text-green-700",
  kedaluwarsa: "bg-slate-100 text-slate-600",
};

function formatSisa(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Versi admin pusat dari halaman monitoring ujian - read-only, lintas sekolah. */
export default function JadwalUjianDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [judul, setJudul] = useState("");
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-pusat/jadwal-ujian/${id}/attempts`);
      const data = await res.json().catch(() => null);
      if (!ignore) {
        if (res.ok) {
          const a = data.assignment;
          setJudul(
            a
              ? `${a.package.nama}${a.class ? ` — ${a.class.tingkat}${a.class.namaRombel}` : ""} · ${a.school?.nama ?? "-"}`
              : "",
          );
          setAttempts(data.attempts ?? []);
        } else {
          setError(data?.error ?? "Gagal memuat data.");
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin-pusat/jadwal-ujian" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke Jadwal Ujian
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{judul || "Sesi Siswa"}</h1>
        <p className="text-sm text-slate-500">
          Pantauan lintas sekolah - jeda/lanjutkan sesi tetap dilakukan admin sekolah masing-masing.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {attempts === null && !error && <p className="text-sm text-slate-500">Memuat...</p>}
      {attempts?.length === 0 && (
        <EmptyState title="Belum ada siswa yang mulai" description="Belum ada siswa yang mengerjakan penugasan ini." />
      )}

      {attempts && attempts.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Siswa</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Sisa waktu</th>
                <th className="px-4 py-2 font-medium">Nilai</th>
                <th className="px-4 py-2 font-medium">Pindah tab</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <Fragment key={a.id}>
                  <tr className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-900">{a.studentNama}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[a.status]}`}>
                        {STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {a.status === "berjalan" || a.status === "paused" ? formatSisa(a.sisaDetik) : "-"}
                    </td>
                    <td className="px-4 py-2">{a.skorAkhir?.toFixed(0) ?? "-"}</td>
                    <td className="px-4 py-2">
                      {a.tabSwitchCount > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          {a.tabSwitchCount}x
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {(a.status === "selesai" || a.status === "kedaluwarsa") && (
                        <span className="inline-flex items-center gap-3">
                          <a
                            href={`/api/siswa/attempts/${a.id}/rapor`}
                            className="text-sm font-medium text-slate-600 hover:underline"
                          >
                            Rapor (PDF)
                          </a>
                          <button
                            onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                            className="text-sm font-medium text-slate-600 hover:underline"
                          >
                            Analisis AI
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                  {expandedId === a.id && (
                    <tr className="border-b border-slate-100 bg-slate-50 last:border-0">
                      <td colSpan={6} className="px-4 py-3">
                        <AnalisisAiPanel attemptId={a.id} canTrigger />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
