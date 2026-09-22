"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { IconDocument } from "@/components/ui/empty-state-icons";

type SourcePackage = {
  id: string;
  code: string;
  nama: string;
  jenjang: string;
  mapel: string;
  jumlahSoal: number;
  sudahDiimpor: boolean;
};

export function ImportPackageList() {
  const [packages, setPackages] = useState<SourcePackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/soal-import/packages");
      const data = await res.json().catch(() => null);
      if (ignore) return;
      if (!res.ok) {
        setError(data?.error ?? "Gagal memuat daftar paket.");
        setPackages([]);
        return;
      }
      setPackages(data.packages ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Impor dari soal.ayotka.id"
        description="Paket berstatus diterbitkan di soal.ayotka.id - tarik ke Bank Soal ayotka-app sebagai paket draft."
      />

      {error && <Alert variant="danger">{error}</Alert>}

      {packages === null ? (
        <TableSkeleton rows={5} columns={5} />
      ) : packages.length === 0 ? (
        <EmptyState
          icon={<IconDocument />}
          title="Belum ada paket yang bisa diimpor"
          description="Paket baru bisa ditarik setelah statusnya diterbitkan di soal.ayotka.id (30/30 soal disetujui validator)."
        />
      ) : (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Kode</Th>
                <Th>Nama</Th>
                <Th>Jenjang</Th>
                <Th>Mapel</Th>
                <Th>Soal</Th>
                <Th>Status</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <tbody>
              {packages.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-mono text-xs">{p.code}</Td>
                  <Td>{p.nama}</Td>
                  <Td>{p.jenjang}</Td>
                  <Td>{p.mapel}</Td>
                  <Td>{p.jumlahSoal}</Td>
                  <Td>
                    {p.sudahDiimpor ? (
                      <Badge variant="success">Sudah diimpor</Badge>
                    ) : (
                      <Badge variant="neutral">Belum diimpor</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin-pusat/bank-soal/impor/${p.id}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      {p.sudahDiimpor ? "Lihat / impor ulang" : "Preview"} &rarr;
                    </Link>
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
