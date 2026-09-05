"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconCheckCircle } from "@/components/ui/empty-state-icons";
import { formatWIB } from "@/lib/utils/datetime";

type AttemptRow = {
  id: string;
  studentNama: string;
  jalur: "A" | "B";
  sekolahNama: string;
  paketNama: string;
  status: "berjalan" | "paused" | "selesai" | "kedaluwarsa";
  tabSwitchCount: number;
  mulaiAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  berjalan: "Sedang mengerjakan",
  paused: "Dijeda",
  selesai: "Selesai",
  kedaluwarsa: "Waktu habis",
};

const JALUR_LABEL: Record<string, string> = { A: "Jalur A (sekolah)", B: "Jalur B (mandiri)" };

export default function PelanggaranUjianPage() {
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/pelanggaran-ujian");
      const data = await res.json().catch(() => null);
      if (!ignore) {
        if (res.ok) setAttempts(data.attempts ?? []);
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
        title="Pelanggaran Ujian"
        description="Attempt yang tercatat berpindah tab/aplikasi lain selama mengerjakan ujian, lintas semua sekolah (Tiket 4.13)."
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {attempts === null && !error && <TableSkeleton columns={7} />}
      {attempts?.length === 0 && (
        <EmptyState
          icon={<IconCheckCircle />}
          title="Belum ada pelanggaran tercatat"
          description="Belum ada siswa yang terdeteksi berpindah tab selama ujian berlangsung."
        />
      )}

      {attempts && attempts.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Siswa</Th>
                <Th>Jalur</Th>
                <Th>Sekolah</Th>
                <Th>Paket</Th>
                <Th>Mulai</Th>
                <Th>Status</Th>
                <Th>Pindah tab</Th>
              </Tr>
            </Thead>
            <tbody>
              {attempts.map((a) => (
                <Tr key={a.id}>
                  <Td className="font-medium text-slate-900">{a.studentNama}</Td>
                  <Td className="text-xs text-slate-500">{JALUR_LABEL[a.jalur]}</Td>
                  <Td>{a.sekolahNama}</Td>
                  <Td>{a.paketNama}</Td>
                  <Td className="text-xs">{formatWIB(a.mulaiAt)}</Td>
                  <Td>{STATUS_LABEL[a.status]}</Td>
                  <Td>
                    <Badge variant="danger">{a.tabSwitchCount}x</Badge>
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
