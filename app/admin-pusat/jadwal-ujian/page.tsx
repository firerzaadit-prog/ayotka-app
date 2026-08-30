"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconCalendar } from "@/components/ui/empty-state-icons";
import { formatWIB } from "@/lib/utils/datetime";

type AssignmentRow = {
  id: string;
  sekolahNama: string;
  paketNama: string;
  kelas: string;
  mulai: string;
  selesai: string;
  metodeDistribusi: "otomatis" | "manual";
  isActive: boolean;
  jumlahAttempt: number;
};

const METODE_LABEL: Record<string, string> = { otomatis: "Otomatis (bergilir)", manual: "Manual" };

export default function JadwalUjianPage() {
  const [assignments, setAssignments] = useState<AssignmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        description="Semua penugasan ujian (jendela waktu, paket, rombel) dari seluruh sekolah, hanya untuk dipantau - buat/ubah penugasan tetap dilakukan admin sekolah masing-masing."
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {assignments === null && !error && <TableSkeleton columns={7} />}
      {assignments?.length === 0 && (
        <EmptyState
          icon={<IconCalendar />}
          title="Belum ada penugasan ujian"
          description="Belum ada sekolah yang membuat penugasan ujian."
        />
      )}

      {assignments && assignments.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Sekolah</Th>
                <Th>Paket</Th>
                <Th>Rombel</Th>
                <Th>Jendela waktu</Th>
                <Th>Distribusi</Th>
                <Th>Attempt</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <tbody>
              {assignments.map((a) => (
                <Tr key={a.id}>
                  <Td className="font-medium text-slate-900">{a.sekolahNama}</Td>
                  <Td>
                    <Link href={`/admin-pusat/jadwal-ujian/${a.id}`} className="text-slate-900 hover:underline">
                      {a.paketNama}
                    </Link>
                  </Td>
                  <Td>{a.kelas}</Td>
                  <Td className="text-xs">
                    {formatWIB(a.mulai)} — {formatWIB(a.selesai)}
                  </Td>
                  <Td>{METODE_LABEL[a.metodeDistribusi]}</Td>
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
      )}
    </div>
  );
}
