"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";

type ClassOption = { id: string; tingkat: number; namaRombel: string };
type SubjectOption = { id: string; nama: string; jenjang: "SD" | "SMP" };
type Kompetensi = { kode: string; deskripsi: string; materi: string; jmlBenar: number; jmlSoal: number; persentase: number };
type RankingRow = { studentId: string; nama: string; rataRata: number; jumlahAttempt: number };

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
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Analitik</h1>
        <p className="text-sm text-slate-500">
          Kompetensi terlemah & ranking siswa berdasarkan hasil ujian yang sudah selesai.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Kelas</label>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!error && kompetensi !== null && ranking !== null && jumlahAttempt === 0 && (
        <EmptyState
          title="Belum ada data"
          description="Belum ada ujian yang selesai dikerjakan untuk kelas/mapel yang dipilih."
        />
      )}

      {jumlahAttempt > 0 && (
        <>
          <div>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Kompetensi Terlemah</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Kompetensi</th>
                    <th className="px-4 py-2 font-medium">Materi</th>
                    <th className="px-4 py-2 font-medium">Benar</th>
                    <th className="px-4 py-2 font-medium">Persentase</th>
                  </tr>
                </thead>
                <tbody>
                  {kompetensi?.map((k) => (
                    <tr key={k.kode} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs">{k.kode}</span> {k.deskripsi}
                      </td>
                      <td className="px-4 py-2 text-slate-500">{k.materi}</td>
                      <td className="px-4 py-2">
                        {k.jmlBenar}/{k.jmlSoal}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            k.persentase < 60
                              ? "bg-red-100 text-red-700"
                              : k.persentase < 80
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                          }`}
                        >
                          {k.persentase.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Ranking Siswa</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="px-4 py-2 font-medium">Siswa</th>
                    <th className="px-4 py-2 font-medium">Rata-rata nilai</th>
                    <th className="px-4 py-2 font-medium">Jumlah ujian</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking?.map((r, i) => (
                    <tr key={r.studentId} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">{r.nama}</td>
                      <td className="px-4 py-2">{r.rataRata.toFixed(1)}</td>
                      <td className="px-4 py-2">{r.jumlahAttempt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
