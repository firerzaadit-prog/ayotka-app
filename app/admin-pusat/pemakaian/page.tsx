"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconChart } from "@/components/ui/empty-state-icons";

type Counter = {
  id: string;
  jmlAttempt: number;
  jmlAnalisisAi: number;
  user: { email: string; studentProfile: { nama: string; jalur: "A" | "B" } | null };
};

type UsageResponse = { periode: string; counters: Counter[] };

function currentPeriode(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Tiket 6.11 (Bagian 7.1 brief): laporan usage_counters - monitoring pemakaian, BUKAN pembatas otomatis (batas wajar sudah dihapus). */
export default function PemakaianPage() {
  const [periode, setPeriode] = useState(currentPeriode());
  const [data, setData] = useState<UsageResponse | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setData(null);
      const res = await fetch(`/api/admin-pusat/usage-counters?periode=${periode}`);
      const json = await res.json().catch(() => null);
      if (!ignore && res.ok) {
        setData(json);
        setPage(1);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [periode]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pemakaian"
        description="Laporan pemakaian attempt & analisis AI per siswa per bulan - untuk memantau biaya, bukan pembatas otomatis (tidak ada siswa yang diblokir karena angka di sini)."
      />

      <div className="flex items-center gap-2">
        <label htmlFor="periode" className="text-sm font-medium text-slate-700">
          Bulan
        </label>
        <Input
          id="periode"
          type="month"
          value={periode}
          onChange={(e) => setPeriode(e.target.value)}
          className="w-40"
        />
      </div>

      {!data && <TableSkeleton columns={4} />}
      {data?.counters.length === 0 && (
        <EmptyState icon={<IconChart />} title="Belum ada data" description="Belum ada pemakaian tercatat pada bulan ini." />
      )}

      {data && data.counters.length > 0 && (() => {
        const totalPages = Math.max(1, Math.ceil(data.counters.length / pageSize));
        const pageRows = data.counters.slice((page - 1) * pageSize, page * pageSize);
        return (
          <div className="flex flex-col gap-3">
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Siswa</Th>
                    <Th>Jalur</Th>
                    <Th>Jml attempt</Th>
                    <Th>Jml analisis AI</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {pageRows.map((c) => (
                    <Tr key={c.id}>
                      <Td>{c.user.studentProfile?.nama ?? c.user.email}</Td>
                      <Td>
                        {c.user.studentProfile?.jalur === "B" ? "Mandiri" : c.user.studentProfile?.jalur === "A" ? "Sekolah" : "-"}
                      </Td>
                      <Td>{c.jmlAttempt}</Td>
                      <Td>{c.jmlAnalisisAi}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={data.counters.length}
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
