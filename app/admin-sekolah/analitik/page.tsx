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
import { formatWIBDate } from "@/lib/utils/datetime";

type PeriodeOpsi = { id: string; nama: string | null; mulai: string; berakhir: string };

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
  // Saring per periode langganan ("" = semua waktu). Alumni tetap terhitung; hanya siswa yang dihapus yang keluar.
  const [periodeList, setPeriodeList] = useState<PeriodeOpsi[]>([]);
  const [periodeId, setPeriodeId] = useState("");
  const qsPeriode = periodeId ? `?periodeId=${periodeId}` : "";

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-sekolah/periode");
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok) setPeriodeList(data.periode ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // Kesiapan TKA selalu gabungan semua mapel KESIAPAN_SUBJECTS untuk seluruh
  // sekolah (pada periode terpilih) - diambil ulang saat periode berganti.
  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-sekolah/kesiapan${qsPeriode}`);
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok) setKesiapan(data.kesiapan ?? null);
    })();
    return () => {
      ignore = true;
    };
  }, [qsPeriode]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-sekolah/analitik${qsPeriode}`);
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
  }, [qsPeriode]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analitik"
        description="Kompetensi terlemah & ranking siswa berdasarkan hasil ujian yang sudah selesai."
        action={
          jumlahAttempt > 0 && (
            <a href={`/api/admin-sekolah/analitik/export${qsPeriode}`} className={buttonClassName("secondary")}>
              Unduh Rekap (Excel)
            </a>
          )
        }
      />

      {periodeList.length > 0 && (
        <div className="w-full max-w-md">
          <label htmlFor="pilihPeriode" className="mb-1 block text-xs font-medium text-slate-500">
            Periode
          </label>
          <select
            id="pilihPeriode"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={periodeId}
            onChange={(e) => setPeriodeId(e.target.value)}
          >
            <option value="">Semua waktu</option>
            {periodeList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama ?? "Periode langganan"} ({formatWIBDate(p.mulai)} - {formatWIBDate(p.berakhir)})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Siswa yang sudah lulus (alumni) tetap terhitung, jadi angkatan lalu bisa dibandingkan.
          </p>
        </div>
      )}

      {kesiapan && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Kesiapan TKA</h2>
          <p className="mb-1 text-sm text-slate-500">
            Berdasarkan skor terbaik tiap siswa dari <strong>seluruh jenis ujian (Try Out Sekolah, Try Out Nasional, maupun Try Out Mandiri)</strong>. Kategori capaian mengacu pada standar resmi Kemendikdasmen (Kurang/Memadai/Baik/Istimewa).
          </p>
          <p className="mb-3 text-xs text-slate-400">
            Catatan: Angka SD memakai standar SMP karena Kemendikdasmen belum merilis rentang nilai resmi khusus SD. IPA &amp; Bahasa Inggris (SMP) memakai standar kategori Bahasa Indonesia SMP karena kedua mapel ini di luar cakupan resmi TKA, yang hanya menguji Matematika &amp; Bahasa Indonesia.
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
              periodeId={periodeId || null}
            />
          </div>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {!error && kompetensi !== null && ranking !== null && jumlahAttempt === 0 && (
        <EmptyState
          icon={<IconChart />}
          title="Belum ada data"
          description={
            periodeId
              ? "Belum ada ujian yang selesai dikerjakan pada periode ini."
              : "Belum ada ujian yang selesai dikerjakan di sekolah ini."
          }
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
