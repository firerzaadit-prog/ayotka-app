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
import type { KesiapanRingkasan } from "@/lib/analytics/kesiapan";

type ClassOption = { id: string; tingkat: number; namaRombel: string };
type SubjectOption = { id: string; nama: string; jenjang: "SD" | "SMP" };
type Kompetensi = { kode: string; deskripsi: string; materi: string; jmlBenar: number; jmlSoal: number; persentase: number };
type RankingRow = { studentId: string; nama: string; rataRata: number; jumlahAttempt: number };

const selectClassName =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

/** Tiket 5.7: dashboard analitik - per kelas/mapel, kompetensi terlemah, ranking (admin-only). */
export default function AnalitikPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [kompetensi, setKompetensi] = useState<Kompetensi[] | null>(null);
  const [ranking, setRanking] = useState<RankingRow[] | null>(null);
  const [jumlahAttempt, setJumlahAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [kesiapan, setKesiapan] = useState<KesiapanRingkasan | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [classRes, subjectRes] = await Promise.all([
        fetch("/api/admin-sekolah/kelas"),
        fetch("/api/admin-pusat/subjects"),
      ]);
      const classData = await classRes.json().catch(() => null);
      const subjectData = await subjectRes.json().catch(() => null);
      if (!ignore) {
        setClasses(classData?.classes ?? []);
        setSubjects(subjectData?.subjects ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // Kesiapan TKA tidak dipengaruhi filter kelas/mapel di atas (selalu
  // gabungan semua mapel KESIAPAN_SUBJECTS untuk seluruh sekolah) - diambil
  // sekali saat halaman dibuka, bukan di dalam effect filter di bawah.
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
      if (subjectId) qs.set("subjectId", subjectId);
      const res = await fetch(`/api/admin-sekolah/analitik?${qs.toString()}`);
      const data = await res.json().catch(() => null);
      if (!ignore) {
        if (res.ok) {
          setKompetensi(data.kompetensiTerlemah ?? []);
          setRanking(data.ranking ?? []);
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
  }, [classId, subjectId]);

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
                ...(subjectId ? { subjectId } : {}),
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
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Mapel</label>
          <select
            className={selectClassName}
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">Semua mapel</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
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
          description="Belum ada ujian yang selesai dikerjakan untuk kelas/mapel yang dipilih."
        />
      )}

      {jumlahAttempt > 0 && (
        <>
          <div>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Kompetensi Terlemah</h2>
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
                  {kompetensi?.map((k) => (
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
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Ranking Siswa</h2>
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
                  {ranking?.map((r, i) => (
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
          </div>
        </>
      )}
    </div>
  );
}
