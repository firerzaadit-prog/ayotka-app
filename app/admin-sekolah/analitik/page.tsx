"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { IconChart } from "@/components/ui/empty-state-icons";
import { KesiapanCard } from "@/components/ui/kesiapan-breakdown";
import { KesiapanSiswaList } from "@/components/analytics/kesiapan-siswa-list";
import type { KesiapanRingkasan } from "@/lib/analytics/kesiapan";

type Kompetensi = { deskripsi: string; elemen: string; jmlBenar: number; jmlSoal: number; persentase: number };
type RankingRow = { studentId: string; nama: string; rataRata: number; jumlahAttempt: number };
type PerMapelAnalitik = { subjectId: string; subjectNama: string; kompetensi: Kompetensi[]; ranking: RankingRow[] };

function KompetensiTable({ kompetensi }: { kompetensi: Kompetensi[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(kompetensi.length / pageSize));
  const pageRows = kompetensi.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex flex-col gap-3">
      <TableContainer>
        <Table>
          <Thead>
            <Tr>
              <Th>Kompetensi</Th>
              <Th>Materi</Th>
              <Th>Benar</Th>
              <Th>Persentase</Th>
            </Tr>
          </Thead>
          <tbody>
            {pageRows.map((k) => (
              <Tr key={`${k.elemen}-${k.deskripsi}`}>
                <Td>{k.deskripsi}</Td>
                <Td className="text-slate-500">{k.elemen}</Td>
                <Td>
                  {k.jmlBenar}/{k.jmlSoal}
                </Td>
                <Td>
                  <Badge variant={k.persentase < 60 ? "danger" : k.persentase < 80 ? "warning" : "success"}>
                    {k.persentase.toFixed(0)}%
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
        totalItems={kompetensi.length}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}

function RankingTable({ ranking }: { ranking: RankingRow[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(ranking.length / pageSize));
  const pageRows = ranking.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex flex-col gap-3">
      <TableContainer>
        <Table>
          <Thead>
            <Tr>
              <Th>#</Th>
              <Th>Siswa</Th>
              <Th>Rata-rata nilai</Th>
              <Th>Jumlah ujian</Th>
            </Tr>
          </Thead>
          <tbody>
            {pageRows.map((r, i) => (
              <Tr key={r.studentId}>
                <Td className="text-slate-500">{(page - 1) * pageSize + i + 1}</Td>
                <Td className="font-medium text-slate-900">{r.nama}</Td>
                <Td>{r.rataRata.toFixed(1)}</Td>
                <Td>{r.jumlahAttempt}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableContainer>
      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={ranking.length}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}

/**
 * Tiket 5.7: dashboard analitik - kompetensi terlemah & ranking (admin-only),
 * filter kelas manual + dipecah OTOMATIS per mata pelajaran (gabungan +
 * tiap mapel sekaligus, sama seperti pola kartu Kesiapan TKA), bukan lewat
 * filter mapel manual satu-per-satu.
 */
export default function AnalitikPage() {
  const [kompetensi, setKompetensi] = useState<Kompetensi[] | null>(null);
  const [ranking, setRanking] = useState<RankingRow[] | null>(null);
  const [perMapel, setPerMapel] = useState<PerMapelAnalitik[]>([]);
  const [jumlahAttempt, setJumlahAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [kesiapan, setKesiapan] = useState<KesiapanRingkasan | null>(null);

  // Kesiapan TKA selalu gabungan semua mapel KESIAPAN_SUBJECTS untuk seluruh
  // sekolah - diambil sekali saat halaman dibuka, bukan di dalam effect di bawah.
  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-sekolah/kesiapan");
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok) setKesiapan(data.kesiapan ?? null);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-sekolah/analitik");
      const data = await res.json().catch(() => null);
      if (!ignore) {
        if (res.ok) {
          setKompetensi(data.kompetensiTerlemah ?? []);
          setRanking(data.ranking ?? []);
          setPerMapel(data.perMapel ?? []);
          setJumlahAttempt(data.jumlahAttempt ?? 0);
          setError(null);
        } else {
          setError(data?.error ?? "Gagal memuat data analitik.");
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analitik"
        description="Kompetensi terlemah & ranking siswa berdasarkan hasil ujian yang sudah selesai."
        action={
          jumlahAttempt > 0 && (
            <a href="/api/admin-sekolah/analitik/export" className={buttonClassName("secondary")}>
              Unduh Rekap (Excel)
            </a>
          )
        }
      />

      {kesiapan && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Kesiapan TKA</h2>
          <p className="mb-1 text-sm text-slate-500">
            Berdasarkan skor terbaik tiap siswa & kategori capaian resmi Kemendikdasmen (Kurang/
            Memadai/Baik/Istimewa). Angka SD memakai standar SMP karena Kemendikdasmen belum
            merilis rentang nilai resmi khusus SD.
          </p>
          <p className="mb-3 text-xs text-slate-400">
            IPA &amp; Bahasa Inggris (SMP) memakai standar kategori Bahasa Indonesia SMP - kedua
            mapel ini di luar cakupan resmi TKA, yang hanya menguji Matematika &amp; Bahasa
            Indonesia.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KesiapanCard title="Gabungan (semua mapel)" breakdown={kesiapan.gabungan} />
            {kesiapan.perMapel.map((m) => (
              <KesiapanCard key={m.subjectNama} title={m.subjectNama} breakdown={m.breakdown} />
            ))}
          </div>
          <div className="mt-6">
            <KesiapanSiswaList
              endpoint="/api/admin-sekolah/kesiapan/siswa"
              studentDetailHrefBase="/admin-sekolah/siswa"
            />
          </div>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {!error && kompetensi !== null && ranking !== null && jumlahAttempt === 0 && (
        <EmptyState
          icon={<IconChart />}
          title="Belum ada data"
          description="Belum ada ujian yang selesai dikerjakan di sekolah ini."
        />
      )}

      {jumlahAttempt > 0 && (
        <>
          <div>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Kompetensi Terlemah</h2>
            <p className="mb-3 text-sm text-slate-500">
              Dipecah otomatis per mata pelajaran - kompetensi tiap mapel dinilai terpisah, bukan
              dicampur jadi satu daftar.
            </p>
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Gabungan (semua mapel)</h3>
                <KompetensiTable kompetensi={kompetensi ?? []} />
              </div>
              {perMapel.map((m) => (
                <div key={m.subjectId}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">{m.subjectNama}</h3>
                  <KompetensiTable kompetensi={m.kompetensi} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Ranking Siswa</h2>
            <p className="mb-3 text-sm text-slate-500">
              Dipecah otomatis per mata pelajaran - rata-rata gabungan mencampur nilai lintas
              mapel, jadi ranking per mapel lebih adil untuk dibandingkan.
            </p>
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Gabungan (semua mapel)</h3>
                <RankingTable ranking={ranking ?? []} />
              </div>
              {perMapel.map((m) => (
                <div key={m.subjectId}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">{m.subjectNama}</h3>
                  <RankingTable ranking={m.ranking} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
