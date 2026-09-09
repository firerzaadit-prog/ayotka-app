"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { IconChart } from "@/components/ui/empty-state-icons";
import { KESIAPAN_SUBJECTS, KATEGORI_LABEL, KATEGORI_BADGE_VARIANT } from "@/lib/analytics/kesiapan";
import type { KategoriKesiapan } from "@/lib/exam/scoring";

type SiswaKesiapanRow = {
  studentId: string;
  nama: string;
  nisn: string | null;
  skorAkhir: number;
  kategori: KategoriKesiapan;
  schoolNama?: string;
};

const selectClassName =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

/**
 * Daftar siswa per kategori Kesiapan TKA untuk SATU mata pelajaran sekaligus
 * (bukan gabungan semua mapel seperti KesiapanCard) - drill-down dari kartu/
 * tabel ringkasan agregat ke identitas siswa. Dipakai bareng oleh halaman
 * Analitik admin sekolah (1 sekolah) dan dashboard dinas pendidikan (lintas
 * sekolah, showSekolahColumn=true), masing-masing lewat endpoint API yang
 * scoping-nya sudah ditegakkan server-side.
 */
export function KesiapanSiswaList({
  endpoint,
  jenjang,
  wilayah,
  schoolId,
  showSekolahColumn = false,
  studentDetailHrefBase,
}: {
  endpoint: string;
  jenjang?: string;
  wilayah?: string;
  schoolId?: string;
  showSekolahColumn?: boolean;
  /** Kalau diisi, nama siswa jadi tautan ke halaman detail riwayatnya (mis. "/admin-sekolah/siswa"). */
  studentDetailHrefBase?: string;
}) {
  const [mapel, setMapel] = useState<string>(KESIAPAN_SUBJECTS[0]);
  const [kategori, setKategori] = useState<KategoriKesiapan | "">("");
  const [siswa, setSiswa] = useState<SiswaKesiapanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    let ignore = false;
    // Debounce 300ms - jenjang/wilayah dioper dari filter halaman induk
    // (dinas pendidikan) yang berubah tiap ketikan pada input teks bebas.
    const timeout = setTimeout(async () => {
      setSiswa(null);
      setError(null);
      setPage(1);
      const qs = new URLSearchParams({ mapel });
      if (kategori) qs.set("kategori", kategori);
      if (jenjang) qs.set("jenjang", jenjang);
      if (wilayah) qs.set("wilayah", wilayah);
      if (schoolId) qs.set("schoolId", schoolId);
      const res = await fetch(`${endpoint}?${qs.toString()}`);
      const data = await res.json().catch(() => null);
      if (ignore) return;
      if (res.ok) {
        setSiswa(data.siswa ?? []);
      } else {
        setError(data?.error ?? "Gagal memuat daftar siswa.");
      }
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(timeout);
    };
  }, [endpoint, mapel, kategori, jenjang, wilayah, schoolId]);

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold text-slate-900">Daftar Siswa per Kategori</h2>
      <p className="mb-3 text-sm text-slate-500">
        Pilih mata pelajaran dan kategori untuk melihat siswa secara individual berdasarkan skor
        terbaiknya, bukan cuma jumlah/persentase agregat.
      </p>
      <div className="mb-4 flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Mata Pelajaran</label>
          <select className={selectClassName} value={mapel} onChange={(e) => setMapel(e.target.value)}>
            {KESIAPAN_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Kategori</label>
          <select
            className={selectClassName}
            value={kategori}
            onChange={(e) => setKategori(e.target.value as KategoriKesiapan | "")}
          >
            <option value="">Semua kategori</option>
            {(Object.keys(KATEGORI_LABEL) as KategoriKesiapan[]).map((k) => (
              <option key={k} value={k}>
                {KATEGORI_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {!error && siswa === null && <TableSkeleton rows={5} columns={showSekolahColumn ? 5 : 4} />}

      {!error && siswa !== null && siswa.length === 0 && (
        <EmptyState
          icon={<IconChart />}
          title="Belum ada siswa"
          description="Belum ada siswa yang sesuai dengan mata pelajaran/kategori yang dipilih."
        />
      )}

      {!error && siswa !== null && siswa.length > 0 && (() => {
        const totalPages = Math.max(1, Math.ceil(siswa.length / pageSize));
        const pageRows = siswa.slice((page - 1) * pageSize, page * pageSize);
        return (
          <div className="flex flex-col gap-3">
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Siswa</Th>
                    <Th>NISN</Th>
                    {showSekolahColumn && <Th>Sekolah</Th>}
                    <Th>Skor Terbaik</Th>
                    <Th>Kategori</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {pageRows.map((s) => (
                    <Tr key={s.studentId}>
                      <Td className="font-medium text-slate-900">
                        {studentDetailHrefBase ? (
                          <Link
                            href={`${studentDetailHrefBase}/${s.studentId}`}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            {s.nama}
                          </Link>
                        ) : (
                          s.nama
                        )}
                      </Td>
                      <Td className="text-slate-500">{s.nisn ?? "—"}</Td>
                      {showSekolahColumn && <Td className="text-slate-500">{s.schoolNama ?? "—"}</Td>}
                      <Td>{s.skorAkhir.toFixed(1)}</Td>
                      <Td>
                        <Badge variant={KATEGORI_BADGE_VARIANT[s.kategori]}>{KATEGORI_LABEL[s.kategori]}</Badge>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={siswa.length}
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
