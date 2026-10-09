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
import { KemendikdasmenDayaSerapView } from "@/components/analytics/kemendikdasmen-daya-serap-view";
import type { JenjangResmi, MapelKey } from "@/lib/indikator/hierarki-resmi";
import { BarChart3, Users } from "lucide-react";

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
 * Dashboard Analitik Admin Sekolah:
 * 1. Tab Hierarki Daya Serap Kemendikdasmen (sesuai portal resmi Kemendikdasmen RI).
 * 2. Tab Kesiapan TKA & Ranking Siswa.
 */
export default function AnalitikPage() {
  const [activeTab, setActiveTab] = useState<"daya-serap" | "kesiapan-ranking">("daya-serap");

  // State Profil Sekolah
  const [schoolNama, setSchoolNama] = useState<string>("");
  const [schoolJenjang, setSchoolJenjang] = useState<JenjangResmi>("SMP");

  // State Kemendikdasmen Filter
  const [activeJenjang, setActiveJenjang] = useState<JenjangResmi>("SMP");
  const [activeMapelKey, setActiveMapelKey] = useState<MapelKey>("bahasa-indonesia");
  const [schoolScores, setSchoolScores] = useState<Map<string, { dayaSerap: number; jmlSoal: number }>>(new Map());
  const [mapelList, setMapelList] = useState<Array<{ subjectId: string; nama: string; jenjang: string }>>([]);

  // State Kesiapan & Ranking
  const [kompetensi, setKompetensi] = useState<Kompetensi[] | null>(null);
  const [ranking, setRanking] = useState<RankingRow[] | null>(null);
  const [perMapel, setPerMapel] = useState<PerMapelAnalitik[]>([]);
  const [jumlahAttempt, setJumlahAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [kesiapan, setKesiapan] = useState<KesiapanRingkasan | null>(null);

  // Filter Periode & Kategori Ujian
  const [periodeList, setPeriodeList] = useState<PeriodeOpsi[]>([]);
  const [periodeId, setPeriodeId] = useState("");
  const [kategoriUjian, setKategoriUjian] = useState<"semua" | "sekolah" | "nasional" | "mandiri">("semua");

  const qsParams = new URLSearchParams();
  if (periodeId) qsParams.set("periodeId", periodeId);
  if (kategoriUjian !== "semua") qsParams.set("kategoriUjian", kategoriUjian);
  const qsString = qsParams.toString() ? `?${qsParams.toString()}` : "";

  // 1. Ambil Profil Sekolah (Nama & Jenjang)
  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-sekolah/profil");
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok && data?.school) {
        setSchoolNama(data.school.nama ?? "");
        const j = (data.school.jenjang ?? "SMP").toUpperCase() as JenjangResmi;
        setSchoolJenjang(j);
        setActiveJenjang(j);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // 2. Ambil Daftar Periode
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

  // 3. Ambil Kesiapan TKA
  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-sekolah/kesiapan${qsString}`);
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok) setKesiapan(data.kesiapan ?? null);
    })();
    return () => {
      ignore = true;
    };
  }, [qsString]);

  // 4. Ambil Analitik Kompetensi & Ranking
  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-sekolah/analitik${qsString}`);
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
  }, [qsString]);

  // 5. Ambil Daftar Mapel untuk Hierarki Daya Serap
  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-sekolah/laporan-indikator${qsString}`);
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok && data?.mapel) {
        setMapelList(data.mapel);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [qsString]);

  // 6. Ambil Skor Sekolah per Indikator bila Mapel & Jenjang Cocok
  useEffect(() => {
    let ignore = false;
    if (mapelList.length === 0) return;

    const matchedMapel = mapelList.find((m) => {
      const matchJenjang = m.jenjang.toUpperCase() === activeJenjang.toUpperCase();
      const matchMapel =
        activeMapelKey === "matematika"
          ? m.nama.toLowerCase().includes("matematika")
          : m.nama.toLowerCase().includes("indonesia");
      return matchJenjang && matchMapel;
    });

    if (!matchedMapel) {
      setSchoolScores(new Map());
      return;
    }

    (async () => {
      const p = new URLSearchParams();
      p.set("subjectId", matchedMapel.subjectId);
      if (periodeId) p.set("periodeId", periodeId);
      if (kategoriUjian !== "semua") p.set("kategoriUjian", kategoriUjian);

      const res = await fetch(`/api/admin-sekolah/laporan-indikator?${p.toString()}`);
      const data = await res.json().catch(() => null);
      if (ignore) return;

      if (res.ok && data?.data?.laporan?.kelompok) {
        const scoresMap = new Map<string, { dayaSerap: number; jmlSoal: number }>();
        for (const k of data.data.laporan.kelompok) {
          for (const b of k.baris ?? []) {
            scoresMap.set(b.indikator, { dayaSerap: b.dayaSerap, jmlSoal: b.jmlSoal });
            scoresMap.set(b.indikator.trim(), { dayaSerap: b.dayaSerap, jmlSoal: b.jmlSoal });
            scoresMap.set(b.indikator.trim().toLowerCase(), { dayaSerap: b.dayaSerap, jmlSoal: b.jmlSoal });
          }
        }
        setSchoolScores(scoresMap);
      } else {
        setSchoolScores(new Map());
      }
    })();

    return () => {
      ignore = true;
    };
  }, [mapelList, activeJenjang, activeMapelKey, periodeId, kategoriUjian]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analitik"
        description="Analisis capaian kompetensi berstandar resmi Pusmendik Kemendikdasmen RI, kesiapan TKA, dan perankingan siswa."
        action={
          jumlahAttempt > 0 && (
            <a href={`/api/admin-sekolah/analitik/export${qsString}`} className={buttonClassName("secondary")}>
              Unduh Rekap (Excel)
            </a>
          )
        }
      />

      {/* Filter Periode & Kategori Ujian */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {periodeList.length > 0 && (
          <div className="w-full max-w-xs">
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
            <p className="mt-1 text-[10px] text-slate-500 leading-tight">
              Siswa yang sudah lulus (alumni) tetap terhitung, jadi angkatan lalu bisa dibandingkan.
            </p>
          </div>
        )}

        <div className="w-full max-w-xs">
          <label htmlFor="pilihKategoriUjian" className="mb-1 block text-xs font-medium text-slate-500">
            Kategori Ujian (Sumber Data)
          </label>
          <select
            id="pilihKategoriUjian"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={kategoriUjian}
            onChange={(e) => setKategoriUjian(e.target.value as any)}
          >
            <option value="semua">Semua (Gabungan)</option>
            <option value="sekolah">Try Out Sekolah</option>
            <option value="nasional">Try Out Nasional</option>
            <option value="mandiri">Try Out Mandiri</option>
          </select>
        </div>
      </div>

      {/* Navigasi Tab Utama */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("daya-serap")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "daya-serap"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Hierarki Daya Serap Kemendikdasmen</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("kesiapan-ranking")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "kesiapan-ranking"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Kesiapan TKA & Ranking Siswa</span>
        </button>
      </div>

      {/* TAB 1: HIERARKI DAYA SERAP KEMENDIKDASMEN (GAMBAR 1 - 5) */}
      {activeTab === "daya-serap" && (
        <KemendikdasmenDayaSerapView
          initialJenjang={schoolJenjang}
          initialMapel={activeMapelKey}
          namaSekolah={schoolNama}
          schoolScores={schoolScores}
          allowFilterSwitch={true}
          onFilterChange={({ jenjang, mapelKey }) => {
            setActiveJenjang(jenjang);
            setActiveMapelKey(mapelKey);
          }}
        />
      )}

      {/* TAB 2: KESIAPAN TKA & RANKING SISWA */}
      {activeTab === "kesiapan-ranking" && (
        <div className="flex flex-col gap-6">
          {kesiapan && (
            <div>
              <h2 className="mb-2 text-lg font-semibold text-slate-900">Kesiapan TKA</h2>
              <p className="mb-1 text-sm text-slate-500">
                Berdasarkan skor terbaik tiap siswa dari{" "}
                <strong>
                  {kategoriUjian === "semua"
                    ? "seluruh jenis ujian (Try Out Sekolah, Try Out Nasional, maupun Try Out Mandiri)"
                    : `jenis ujian terpilih`}
                </strong>
                . Kategori capaian mengacu pada standar resmi Kemendikdasmen (Kurang/Memadai/Baik/Istimewa).
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
                  endpoint={`/api/admin-sekolah/kesiapan/siswa${qsString}`}
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
      )}
    </div>
  );
}
