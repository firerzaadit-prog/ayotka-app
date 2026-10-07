"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconCalendar } from "@/components/ui/empty-state-icons";
import { formatWIB } from "@/lib/utils/datetime";

type AssignmentRow = {
  id: string;
  sekolahNama: string;
  paketNama: string;
  kategori: "mandiri" | "nasional";
  mulai: string;
  selesai: string;
  isActive: boolean;
  jumlahAttempt: number;
};

export default function JadwalUjianPage() {
  const [assignments, setAssignments] = useState<AssignmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/jadwal-ujian");
      const data = await res.json().catch(() => null);
      if (!ignore) {
        if (res.ok) setAssignments(data.assignments ?? []);
        else setError(data?.error ?? "Gagal memuat data.");
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Jadwal Ujian"
        description="Semua Try Out Bersama (jendela waktu dan paket) dari seluruh sekolah, hanya untuk dipantau - buat/ubah jadwal tetap dilakukan admin sekolah masing-masing."
      />

      <Alert variant="info">
        <strong>Try Out Nasional hanya dijalankan oleh admin pusat</strong> (lewat Bank Soal, kategori Nasional, dengan jendela
        buka mulai/selesai). Sekolah tidak bisa menjadwalkan atau membuatnya di Try Out Bersama. Jika ada baris bertanda
        &quot;Nasional&quot; di bawah, itu dibuat sebelum aturan ini; sekolah hanya bisa menonaktifkan atau menghapusnya.
        Pembahasan dan kunci jawaban tampil langsung begitu siswa selesai, untuk semua siswa dan semua jenis ujian.
      </Alert>

      {error && <Alert variant="danger">{error}</Alert>}
      {assignments === null && !error && <TableSkeleton columns={6} />}
      {assignments?.length === 0 && (
        <EmptyState
          icon={<IconCalendar />}
          title="Belum ada Try Out Bersama"
          description="Belum ada sekolah yang menjadwalkan Try Out Bersama."
        />
      )}

      {assignments && assignments.length > 0 && (() => {
        const totalPages = Math.max(1, Math.ceil(assignments.length / pageSize));
        const pageRows = assignments.slice((page - 1) * pageSize, page * pageSize);
        return (
          <div className="flex flex-col gap-3">
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Sekolah</Th>
                    <Th>Paket</Th>
                    <Th>Jendela waktu</Th>
                    <Th>Attempt</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {pageRows.map((a) => (
                    <Tr key={a.id}>
                      <Td className="font-medium text-slate-900">{a.sekolahNama}</Td>
                      <Td>
                        <Link href={`/admin-pusat/jadwal-ujian/${a.id}`} className="text-slate-900 hover:underline">
                          {a.paketNama}
                        </Link>
                        {a.kategori === "nasional" && (
                          <Badge variant="warning" className="ml-2">
                            Nasional
                          </Badge>
                        )}
                      </Td>
                      <Td className="text-xs">
                        {formatWIB(a.mulai)} — {formatWIB(a.selesai)}
                      </Td>
                      <Td>{a.jumlahAttempt}</Td>
                      <Td>
                        <Badge variant={a.isActive ? "success" : "neutral"}>
                          {a.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={assignments.length}
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
