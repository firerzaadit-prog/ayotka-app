"use client";

import { useEffect, useState } from "react";
import { KemendikdasmenDayaSerapView } from "@/components/analytics/kemendikdasmen-daya-serap-view";
import type { JenjangResmi, MapelKey } from "@/lib/indikator/hierarki-resmi";
import { KesiapanCard } from "@/components/ui/kesiapan-breakdown";
import { KesiapanSiswaList } from "@/components/analytics/kesiapan-siswa-list";
import type { KesiapanRingkasan } from "@/lib/analytics/kesiapan";
import { buttonClassName } from "@/components/ui/button";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";

type PeriodeOpsi = { id: string; nama: string | null; mulai: string; berakhir: string };
type RankingRow = { studentId: string; nama: string; rataRata: number; jumlahAttempt: number };

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
 * Halaman Analitik Admin Sekolah:
 * Desain, tata letak, dan hierarki (Elemen, Subelemen, Kompetensi, Indikator)
 * 100% PERSIS SEPERTI PORTAL RESMI KEMENDIKDASMEN RI (https://tka.kemendikdasmen.go.id/hasiltka/daya-serap).
 */
export default function AnalitikPage() {
  // State Profil Sekolah
  const [schoolNama, setSchoolNama] = useState<string>("");
  const [schoolJenjang, setSchoolJenjang] = useState<JenjangResmi>("SMP");

  // State Kemendikdasmen Filter
  const [activeJenjang, setActiveJenjang] = useState<JenjangResmi>("SMP");
  const [activeMapelKey, setActiveMapelKey] = useState<MapelKey>("matematika");
  const [schoolScores, setSchoolScores] = useState<Map<string, { dayaSerap: number; jmlSoal: number }>>(new Map());
  const [mapelList, setMapelList] = useState<Array<{ subjectId: string; nama: string; jenjang: string }>>([]);

  // State Kesiapan & Ranking (untuk slot tambahan)
  const [ranking, setRanking] = useState<RankingRow[] | null>(null);
  const [jumlahAttempt, setJumlahAttempt] = useState(0);
  const [kesiapan, setKesiapan] = useState<KesiapanRingkasan | null>(null);
  const [_periodeList, setPeriodeList] = useState<PeriodeOpsi[]>([]);
  const [periodeId, _setPeriodeId] = useState("");

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

  // 3. Ambil Kesiapan TKA & Ranking untuk slot tambahan
  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-sekolah/kesiapan`);
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
      const res = await fetch(`/api/admin-sekolah/analitik`);
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok) {
        setRanking(data.ranking ?? []);
        setJumlahAttempt(data.jumlahAttempt ?? 0);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // 4. Ambil Daftar Mapel untuk Hierarki Daya Serap
  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-sekolah/laporan-indikator`);
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok && data?.mapel) {
        setMapelList(data.mapel);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // 5. Ambil Skor Sekolah per Indikator bila Mapel & Jenjang Cocok
  useEffect(() => {
    let ignore = false;

    (async () => {
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
        if (!ignore) setSchoolScores(new Map());
        return;
      }

      const p = new URLSearchParams();
      p.set("subjectId", matchedMapel.subjectId);
      if (periodeId) p.set("periodeId", periodeId);

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
  }, [mapelList, activeJenjang, activeMapelKey, periodeId]);

  // Ranking & Kesiapan Slot (muncul jika tombol "Ranking & Siswa" di kanan atas diklik)
  const rankingSlotContent = (
    <div className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Kesiapan TKA & Ranking Siswa</h2>
          <p className="text-xs text-slate-500">
            Pemetaan siswa berdasarkan skor pengerjaan ujian dan kesiapan kompetensi akademik.
          </p>
        </div>
        {jumlahAttempt > 0 && (
          <a href="/api/admin-sekolah/analitik/export" className={buttonClassName("secondary")}>
            Unduh Rekap (Excel)
          </a>
        )}
      </div>

      {kesiapan && (
        <div>
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

      {ranking && ranking.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Ranking Nilai Siswa</h3>
          <RankingTable ranking={ranking} />
        </div>
      )}
    </div>
  );

  return (
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
      rankingSlot={rankingSlotContent}
    />
  );
}
