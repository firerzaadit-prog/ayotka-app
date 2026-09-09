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
  kelas: string | null;
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
                    <Th>Kelas</Th>
                    <Th>Mulai</Th>
                    <Th>Status</Th>
                    <Th>Nilai</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <tbody>
                  {pageRows.map((a) => (
                    <Tr key={a.id}>
                      <Td className="font-medium text-slate-900">{a.paketNama}</Td>
                      <Td>{a.kelas ?? "Mandiri"}</Td>
                      <Td className="text-xs">{formatWIB(a.mulaiAt)}</Td>
                      <Td>
                        <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                      </Td>
                      <Td>{a.skorAkhir?.toFixed(0) ?? "-"}</Td>
                      <Td className="text-right">
                        <Link href={hrefFor(a)} className="text-sm font-medium text-slate-600 hover:text-slate-900">
                          {a.status === "berjalan" || a.status === "paused" ? "Lanjutkan" : "Lihat hasil"}
                        </Link>
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
