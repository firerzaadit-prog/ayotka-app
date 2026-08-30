"use client";

import { Fragment, use, useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconUsers } from "@/components/ui/empty-state-icons";
import { AnalisisAiPanel } from "@/components/ai/analisis-panel";
import { useToast } from "@/components/ui/toast";

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
const STATUS_VARIANT: Record<string, "info" | "warning" | "success" | "neutral"> = {
  berjalan: "info",
  paused: "warning",
  selesai: "success",
  kedaluwarsa: "neutral",
};

function formatSisa(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Tiket 4.9: pantau & pause/resume attempt siswa untuk satu penugasan. */
export default function PenugasanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const [assignmentNama, setAssignmentNama] = useState("");
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    else toast.error(data?.error ?? "Gagal menjeda sesi.");
  }

  async function handleResume(attemptId: string) {
    const res = await fetch(`/api/admin-sekolah/attempts/${attemptId}/resume`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (res.ok) setRefreshKey((k) => k + 1);
    else toast.error(data?.error ?? "Gagal melanjutkan sesi.");
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

      {error && <Alert variant="danger">{error}</Alert>}

      {attempts === null && !error && <TableSkeleton columns={6} />}
      {attempts?.length === 0 && (
        <EmptyState icon={<IconUsers />} title="Belum ada siswa yang mulai" description="Belum ada siswa yang mengerjakan penugasan ini." />
      )}

      {attempts && attempts.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Siswa</Th>
                <Th>Status</Th>
                <Th>Sisa waktu</Th>
                <Th>Nilai</Th>
                <Th>Pindah tab</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <tbody>
              {attempts.map((a) => (
                <Fragment key={a.id}>
                <Tr>
                  <Td className="font-medium text-slate-900">{a.studentNama}</Td>
                  <Td>
                    <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                  </Td>
                  <Td className="font-mono text-xs">
                    {a.status === "berjalan" || a.status === "paused" ? formatSisa(a.sisaDetik) : "-"}
                  </Td>
                  <Td>{a.skorAkhir?.toFixed(0) ?? "-"}</Td>
                  <Td>
                    {a.tabSwitchCount > 0 ? (
                      <Badge variant="danger">{a.tabSwitchCount}x</Badge>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </Td>
                  <Td className="text-right">
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
                        className="text-sm font-medium text-indigo-700 hover:underline"
                      >
                        Lanjutkan
                      </button>
                    )}
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
                  </Td>
                </Tr>
                {expandedId === a.id && (
                  <Tr className="bg-slate-50">
                    <Td colSpan={6} className="py-3">
                      <AnalisisAiPanel attemptId={a.id} canTrigger />
                    </Td>
                  </Tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
