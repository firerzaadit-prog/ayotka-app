"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

type AttemptRow = {
  id: string;
  studentNama: string;
  status: "berjalan" | "paused" | "selesai" | "kedaluwarsa";
  sisaDetik: number;
  skorAkhir: number | null;
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

/** Tiket 4.9: pantau & pause/resume attempt siswa untuk satu penugasan. */
export default function PenugasanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [assignmentNama, setAssignmentNama] = useState("");
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-sekolah/assignments/${id}/attempts`);
      const data = await res.json();
      if (!ignore) {
        if (res.ok) {
          const a = data.assignment;
          setAssignmentNama(
            a ? `${a.package.nama}${a.class ? ` — ${a.class.tingkat}${a.class.namaRombel}` : ""}` : "",
          );
          setAttempts(data.attempts ?? []);
        } else {
          setError(data.error ?? "Gagal memuat data.");
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id, refreshKey]);

  async function handlePause(attemptId: string) {
    const res = await fetch(`/api/admin-sekolah/attempts/${attemptId}/pause`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (res.ok) setRefreshKey((k) => k + 1);
    else alert(data?.error ?? "Gagal menjeda sesi.");
  }

  async function handleResume(attemptId: string) {
    const res = await fetch(`/api/admin-sekolah/attempts/${attemptId}/resume`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (res.ok) setRefreshKey((k) => k + 1);
    else alert(data?.error ?? "Gagal melanjutkan sesi.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin-sekolah/ujian" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke Penugasan Ujian
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          {assignmentNama || "Sesi Siswa"}
        </h1>
        <p className="text-sm text-slate-500">
          Jeda sesi siswa yang koneksinya terputus, lalu lanjutkan lagi supaya sisa waktunya wajar.
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
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
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
                  <td className="px-4 py-2 text-right">
                    {a.status === "berjalan" && (
                      <button
                        onClick={() => handlePause(a.id)}
                        className="text-sm font-medium text-amber-700 hover:underline"
                      >
                        Jeda
                      </button>
                    )}
                    {a.status === "paused" && (
                      <button
                        onClick={() => handleResume(a.id)}
                        className="text-sm font-medium text-blue-700 hover:underline"
                      >
                        Lanjutkan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
