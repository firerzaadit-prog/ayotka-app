"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconCheckCircle } from "@/components/ui/empty-state-icons";
import { useToast } from "@/components/ui/toast";
import { formatWIB } from "@/lib/utils/datetime";

type FailedAttempt = {
  id: string;
  studentNama: string;
  jalur: "A" | "B";
  sekolahNama: string;
  paketNama: string;
  mapelNama: string;
  status: "selesai" | "kedaluwarsa";
  selesaiAt: string | null;
  error: string;
};

const JALUR_LABEL: Record<string, string> = { A: "Jalur A (sekolah)", B: "Jalur B (mandiri)" };
const STATUS_LABEL: Record<string, string> = { selesai: "Selesai", kedaluwarsa: "Waktu habis" };

const SELECT_CLASS =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

/**
 * Admin pusat: lihat & pulihkan attempt yang analisis AI-nya gagal (baik
 * dipicu otomatis maupun manual), plus atur jatah global analisis AI
 * otomatis (lib/ai/auto-trigger.ts). Retry di sini reuse endpoint manual
 * yang sama dengan tombol "Analisis ulang" di AnalisisAiPanel - sengaja
 * tidak dibatasi jatah, supaya selalu jadi jalur pemulihan yang pasti bisa.
 */
export default function AnalisisAiGagalPage() {
  const toast = useToast();
  const [attempts, setAttempts] = useState<FailedAttempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maxPerSubject, setMaxPerSubject] = useState<number | null>(null);
  const [maxInput, setMaxInput] = useState("");
  const [savingMax, setSavingMax] = useState(false);
  const [filterJalur, setFilterJalur] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const params = new URLSearchParams();
      if (filterJalur) params.set("jalur", filterJalur);
      const res = await fetch(`/api/admin-pusat/analisis-ai-gagal?${params}`);
      const data = await res.json().catch(() => null);
      if (ignore) return;
      if (res.ok) {
        setAttempts(data.attempts ?? []);
        setMaxPerSubject(data.maxPerSubject);
        setMaxInput(String(data.maxPerSubject));
      } else {
        setError(data?.error ?? "Gagal memuat data.");
      }
    })();
    return () => {
      ignore = true;
    };
  }, [filterJalur, refreshKey]);

  async function handleSaveMax() {
    const parsed = Number(maxInput);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
      toast.error("Jatah harus berupa angka bulat 0-100.");
      return;
    }
    setSavingMax(true);
    const res = await fetch("/api/admin-pusat/analisis-ai-gagal", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiAutoAnalysisMaxPerSubject: parsed }),
    });
    const data = await res.json().catch(() => null);
    setSavingMax(false);
    if (res.ok) {
      setMaxPerSubject(data.maxPerSubject);
      setMaxInput(String(data.maxPerSubject));
      toast.success("Jatah analisis AI otomatis diperbarui.");
    } else {
      toast.error(data?.error ?? "Gagal menyimpan jatah.");
    }
  }

  async function handleRetry(id: string) {
    setRetryingId(id);
    const res = await fetch(`/api/attempts/${id}/analisis-ai`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setRetryingId(null);
    if (res.ok) {
      toast.success("Analisis ulang dimulai - hasil akan muncul dalam beberapa saat.");
      setRefreshKey((k) => k + 1);
    } else {
      toast.error(data?.error ?? "Gagal memulai analisis ulang.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Daftar Analisis AI Gagal"
        description="Attempt yang analisis AI-nya gagal diproses, lintas semua sekolah. Klik Analisis ulang untuk memproses ulang - tombol ini tidak dibatasi jatah."
      />

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Jatah Analisis AI Otomatis</p>
          <p className="mt-0.5 max-w-xl text-sm text-slate-500">
            Maksimal berapa kali analisis AI OTOMATIS boleh berjalan untuk satu siswa per mata
            pelajaran (berapa pun attempt yang dikerjakan), supaya biaya AI terkendali. Satu angka
            berlaku global untuk semua sekolah &amp; mata pelajaran. Tombol &quot;Mulai Analisis
            AI&quot;/&quot;Analisis ulang&quot; manual (termasuk di halaman ini) TIDAK terpengaruh
            jatah ini.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-28">
            <Label htmlFor="maxPerSubject">Maks/mapel</Label>
            <Input
              id="maxPerSubject"
              type="number"
              min={0}
              max={100}
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
            />
          </div>
          <Button
            onClick={handleSaveMax}
            disabled={savingMax || maxPerSubject === null || maxInput === String(maxPerSubject)}
          >
            {savingMax ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </Card>

      <div className="w-56">
        <Label htmlFor="filterJalur">Filter jalur</Label>
        <select
          id="filterJalur"
          className={SELECT_CLASS}
          value={filterJalur}
          onChange={(e) => {
            setFilterJalur(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Semua jalur</option>
          <option value="A">Jalur A (sekolah)</option>
          <option value="B">Jalur B (mandiri)</option>
        </select>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {attempts === null && !error && <TableSkeleton columns={7} />}
      {attempts?.length === 0 && (
        <EmptyState
          icon={<IconCheckCircle />}
          title="Tidak ada analisis AI yang gagal"
          description="Semua analisis AI (otomatis maupun manual) berhasil diproses untuk saat ini."
        />
      )}

      {attempts && attempts.length > 0 && (() => {
        const totalPages = Math.max(1, Math.ceil(attempts.length / pageSize));
        const pageRows = attempts.slice((page - 1) * pageSize, page * pageSize);
        return (
          <div className="flex flex-col gap-3">
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Siswa</Th>
                    <Th>Jalur</Th>
                    <Th>Sekolah</Th>
                    <Th>Mapel / Paket</Th>
                    <Th>Selesai</Th>
                    <Th>Pesan Gagal</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <tbody>
                  {pageRows.map((a) => (
                    <Tr key={a.id}>
                      <Td className="font-medium text-slate-900">{a.studentNama}</Td>
                      <Td className="text-xs text-slate-500">{JALUR_LABEL[a.jalur]}</Td>
                      <Td>{a.sekolahNama}</Td>
                      <Td>
                        <p>{a.mapelNama}</p>
                        <p className="text-xs text-slate-400">{a.paketNama}</p>
                      </Td>
                      <Td className="text-xs">
                        {a.selesaiAt ? formatWIB(a.selesaiAt) : "-"}
                        <br />
                        <span className="text-slate-400">{STATUS_LABEL[a.status]}</span>
                      </Td>
                      <Td className="max-w-xs">
                        <p className="line-clamp-2 text-xs text-rose-600" title={a.error}>
                          {a.error}
                        </p>
                      </Td>
                      <Td>
                        <Button
                          variant="secondary"
                          onClick={() => handleRetry(a.id)}
                          disabled={retryingId === a.id}
                          className="px-3 py-1.5 text-xs"
                        >
                          {retryingId === a.id ? "Memproses..." : "Analisis ulang"}
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={attempts.length}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        );
      })()}
    </div>
  );
}
