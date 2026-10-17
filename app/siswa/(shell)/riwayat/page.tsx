"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconClipboardCheck } from "@/components/ui/empty-state-icons";
import { formatWIB } from "@/lib/utils/datetime";

type RiwayatItem = {
  id: string;
  paketNama: string;
  /** Percobaan ke-N pada paket (& jalur) yang sama - lib/exam/percobaan.ts. */
  percobaanKe: number;
  terjadwal: boolean;
  status: "berjalan" | "paused" | "selesai" | "kedaluwarsa";
  skorAkhir: number | null;
  mulaiAt: string;
  selesaiAt: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  berjalan: "Sedang dikerjakan",
  paused: "Dijeda",
  selesai: "Selesai",
  kedaluwarsa: "Waktu habis",
};

const STATUS_VARIANT: Record<RiwayatItem["status"], "info" | "warning" | "success" | "neutral"> = {
  berjalan: "info",
  paused: "warning",
  selesai: "success",
  kedaluwarsa: "neutral",
};

function hrefFor(item: RiwayatItem) {
  return item.status === "berjalan" || item.status === "paused"
    ? `/siswa/attempt/${item.id}`
    : `/siswa/hasil/${item.id}`;
}

/** Tiket 5.6: riwayat semua attempt, tetap bisa dibuka kapan saja. */
export default function RiwayatPage() {
  const [attempts, setAttempts] = useState<RiwayatItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/siswa/attempts");
      const data = await res.json().catch(() => null);
      if (!ignore) {
        if (res.ok) setAttempts(data.attempts ?? []);
        else setError(data?.error ?? "Gagal memuat riwayat.");
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Riwayat Ujian"
        description="Semua ujian yang pernah kamu kerjakan, bisa dibuka kapan saja."
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {attempts === null && !error && <TableSkeleton columns={6} />}
      {attempts?.length === 0 && (
        <EmptyState
          icon={<IconClipboardCheck />}
          title="Belum ada riwayat ujian"
          description="Kerjakan ujian yang ditugaskan sekolahmu atau paket latihan mandiri untuk mulai."
          action={
            <Link href="/siswa/ujian" className={buttonClassName("primary")}>
              Buka Ujian
            </Link>
          }
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
                    <Th>Paket</Th>
                    <Th>Jenis</Th>
                    <Th>Mulai</Th>
                    <Th>Status</Th>
                    <Th>Nilai</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <tbody>
                  {pageRows.map((a) => (
                    <Tr key={a.id}>
                      <Td className="font-semibold text-slate-900">
                        <span>{a.paketNama}</span>
                        <span className="block text-[11px] font-medium text-slate-400">Percobaan ke-{a.percobaanKe}</span>
                      </Td>
                      <Td>
                        {a.terjadwal ? (
                          <span className="inline-flex items-center rounded-md border border-purple-200/80 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
                            Terjadwal
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-indigo-200/80 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                            Mandiri
                          </span>
                        )}
                      </Td>
                      <Td className="text-xs text-slate-500 font-medium">{formatWIB(a.mulaiAt)}</Td>
                      <Td>
                        <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                      </Td>
                      <Td>
                        {a.skorAkhir !== null ? (
                          <span className="font-mono text-base font-bold text-slate-900">
                            {a.skorAkhir.toFixed(0)}
                          </span>
                        ) : (
                          <span className="font-mono text-sm text-slate-400">–</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        {a.status === "berjalan" || a.status === "paused" ? (
                          <Link
                            href={hrefFor(a)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors"
                          >
                            <span>Lanjutkan</span>
                            <span aria-hidden="true">→</span>
                          </Link>
                        ) : (
                          <Link
                            href={hrefFor(a)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700 transition-all"
                          >
                            <span>Lihat hasil</span>
                            <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                            </svg>
                          </Link>
                        )}
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
