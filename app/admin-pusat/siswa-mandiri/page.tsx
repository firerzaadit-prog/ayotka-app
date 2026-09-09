"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconCheckCircle } from "@/components/ui/empty-state-icons";
import { useToast } from "@/components/ui/toast";

type PendingStudent = {
  id: string;
  nama: string;
  jenjang: "SD" | "SMP";
  tingkat: number;
  school: { nama: string; status: string } | null;
  user: { email: string } | null;
};

export default function SiswaMandiriPage() {
  const toast = useToast();
  const [students, setStudents] = useState<PendingStudent[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/siswa-mandiri");
      const data = await res.json();
      if (!ignore) setStudents(data.students ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  async function handleAktivasi(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin-pusat/siswa-mandiri/${id}/aktivasi`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      toast.error(data?.error ?? "Gagal aktivasi.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Siswa Mandiri - Aktivasi"
        description="Panel sementara pengganti alur pembayaran (Fase 6 belum dibangun). Verifikasi pembayaran/identitas secara manual di luar sistem sebelum menekan Aktifkan."
      />

      {students === null && <TableSkeleton columns={5} />}
      {students?.length === 0 && (
        <EmptyState icon={<IconCheckCircle />} title="Tidak ada yang menunggu aktivasi" description="Semua siswa mandiri sudah aktif." />
      )}

      {students && students.length > 0 && (() => {
        const totalPages = Math.max(1, Math.ceil(students.length / pageSize));
        const pageRows = students.slice((page - 1) * pageSize, page * pageSize);
        return (
          <div className="flex flex-col gap-3">
            <TableContainer>
              <Table>
                <Thead>
                  <tr>
                    <Th>Nama</Th>
                    <Th>Email</Th>
                    <Th>Jenjang</Th>
                    <Th>Asal sekolah</Th>
                    <Th></Th>
                  </tr>
                </Thead>
                <tbody>
                  {pageRows.map((s) => (
                    <Tr key={s.id}>
                      <Td className="font-medium text-slate-900">{s.nama}</Td>
                      <Td>{s.user?.email ?? "-"}</Td>
                      <Td>
                        {s.jenjang} {s.tingkat}
                      </Td>
                      <Td>
                        {s.school?.nama ?? "-"}
                        {s.school?.status === "pending_verifikasi" && (
                          <Badge variant="warning" className="ml-2">
                            Sekolah belum terverifikasi
                          </Badge>
                        )}
                      </Td>
                      <Td className="text-right">
                        <Button
                          variant="secondary"
                          onClick={() => handleAktivasi(s.id)}
                          disabled={busyId === s.id}
                        >
                          {busyId === s.id ? "Memproses..." : "Aktifkan"}
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
              totalItems={students.length}
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
