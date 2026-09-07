"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { IconChart } from "@/components/ui/empty-state-icons";
import { KesiapanCard } from "@/components/ui/kesiapan-breakdown";
import { KesiapanSiswaList } from "@/components/analytics/kesiapan-siswa-list";
import type { KesiapanRingkasan } from "@/lib/analytics/kesiapan";

type ClassOption = { id: string; tingkat: number; namaRombel: string };
type Kompetensi = { kode: string; deskripsi: string; materi: string; jmlBenar: number; jmlSoal: number; persentase: number };
type RankingRow = { studentId: string; nama: string; rataRata: number; jumlahAttempt: number };
type PerMapelAnalitik = { subjectId: string; subjectNama: string; kompetensi: Kompetensi[]; ranking: RankingRow[] };

const selectClassName =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

function KompetensiTable({ kompetensi }: { kompetensi: Kompetensi[] }) {
  return (
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
          {kompetensi.map((k) => (
            <Tr key={k.kode}>
              <Td>
                <span className="font-mono text-xs">{k.kode}</span> {k.deskripsi}
              </Td>
              <Td className="text-slate-500">{k.materi}</Td>
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
  );
}

function RankingTable({ ranking }: { ranking: RankingRow[] }) {
  return (
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
          {ranking.map((r, i) => (
            <Tr key={r.studentId}>
              <Td className="text-slate-500">{i + 1}</Td>
              <Td className="font-medium text-slate-900">{r.nama}</Td>
              <Td>{r.rataRata.toFixed(1)}</Td>
              <Td>{r.jumlahAttempt}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableContainer>
  );
}

/**
 * Tiket 5.7: dashboard analitik - kompetensi terlemah & ranking (admin-only),
 * filter kelas manual + dipecah OTOMATIS per mata pelajaran (gabungan +
 * tiap mapel sekaligus, sama seperti pola kartu Kesiapan TKA), bukan lewat
 * filter mapel manual satu-per-satu.
 */
export default function AnalitikPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [kompetensi, setKompetensi] = useState<Kompetensi[] | null>(null);
  const [ranking, setRanking] = useState<RankingRow[] | null>(null);
  const [perMapel, setPerMapel] = useState<PerMapelAnalitik[]>([]);
  const [jumlahAttempt, setJumlahAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [kesiapan, setKesiapan] = useState<KesiapanRingkasan | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-sekolah/kelas");
      const data = await res.json().catch(() => null);
      if (!ignore) setClasses(data?.classes ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // Kesiapan TKA tidak dipengaruhi filter kelas di atas (selalu gabungan
  // semua mapel KESIAPAN_SUBJECTS untuk seluruh sekolah) - diambil sekali
  // saat halaman dibuka, bukan di dalam effect filter di bawah.
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
      const qs = new URLSearchParams();
      if (classId) qs.set("classId", classId);
      const res = await fetch(`/api/admin-sekolah/analitik?${qs.toString()}`);
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
  }, [classId]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analitik"
        description="Kompetensi terlemah & ranking siswa berdasarkan hasil ujian yang sudah selesai."
        action={
          jumlahAttempt > 0 && (
            <a
              href={`/api/admin-sekolah/analitik/export?${new URLSearchParams({
                ...(classId ? { classId } : {}),
              }).toString()}`}
              className={buttonClassName("secondary")}
            >
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
            <KesiapanSiswaList endpoint="/api/admin-sekolah/kesiapan/siswa" />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Kelas</label>
          <select
            className={selectClassName}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">Semua kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.tingkat}
                {c.namaRombel}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {!error && kompetensi !== null && ranking !== null && jumlahAttempt === 0 && (
        <EmptyState
          icon={<IconChart />}
          title="Belum ada data"
          description="Belum ada ujian yang selesai dikerjakan untuk kelas yang dipilih."
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
