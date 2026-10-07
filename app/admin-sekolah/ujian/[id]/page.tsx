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
import { RekapBersama } from "@/components/sekolah/rekap-bersama";

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

type TabPenugasan = "pantau" | "rekap";

const LABEL_TAB: Record<TabPenugasan, string> = { pantau: "Pantau Sesi", rekap: "Rekap Hasil" };

/** Tiket 4.9: pantau & pause/resume attempt siswa untuk satu penugasan (tab Pantau Sesi), plus rekap hasil bersama (tab Rekap Hasil). */
export default function PenugasanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = use(params);
  const { tab: tabAwal } = use(searchParams);
  const [tab, setTab] = useState<TabPenugasan>(tabAwal === "rekap" ? "rekap" : "pantau");
  const toast = useToast();
  const [assignmentNama, setAssignmentNama] = useState("");
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin-sekolah/assignments/${id}/attempts`);
        const data = await res.json();
        if (!ignore) {
          if (res.ok) {
            const a = data.assignment;
            setAssignmentNama(a ? a.package.nama : "");
            setAttempts(data.attempts ?? []);
          } else {
            setError(data.error ?? "Gagal memuat data.");
          }
        }
      } catch {
        if (!ignore) setError("Gagal memuat data. Silakan muat ulang halaman.");
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

  function pilihTab(baru: TabPenugasan) {
    setTab(baru);
    // Simpan pilihan di alamat (tanpa menambah riwayat peramban) supaya muat ulang tetap di tab yang sama.
    const url = new URL(window.location.href);
    if (baru === "rekap") url.searchParams.set("tab", "rekap");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin-sekolah/ujian" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke Try Out Bersama
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          {assignmentNama || "Try Out Bersama"}
        </h1>
        <p className="text-sm text-slate-500">
          {tab === "pantau"
            ? "Jeda sesi siswa yang koneksinya terputus, lalu lanjutkan lagi supaya sisa waktunya wajar."
            : "Peringkat, statistik, dan siapa yang belum mengerjakan. Nilai tiap siswa adalah percobaan pertamanya."}
        </p>
      </div>

      <div role="tablist" aria-label="Bagian Try Out Bersama" className="flex gap-1 border-b border-slate-200">
        {(["pantau", "rekap"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            onClick={() => pilihTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            {LABEL_TAB[t]}
          </button>
        ))}
      </div>

      {tab === "rekap" && (
        <div role="tabpanel" id="panel-rekap" aria-labelledby="tab-rekap">
          <RekapBersama assignmentId={id} />
        </div>
      )}

      {tab === "pantau" && (
      <div role="tabpanel" id="panel-pantau" aria-labelledby="tab-pantau" className="flex flex-col gap-6">
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
                          Analisis Learning Analytics
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
      )}
    </div>
  );
}
