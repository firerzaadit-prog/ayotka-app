"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Label, Input } from "@/components/ui/input";

type SchoolOption = { id: string; nama: string; jenjang: "SD" | "SMP" };
type SubjectOption = { id: string; nama: string; jenjang: "SD" | "SMP" };
type PerSekolah = {
  schoolId: string;
  nama: string;
  jumlahSiswaAktif: number;
  jumlahAttempt: number;
  rataRata: number;
};
type Kompetensi = { kode: string; deskripsi: string; materi: string; jmlBenar: number; jmlSoal: number; persentase: number };
type Tren = { periode: string; jumlahAttempt: number; rataRata: number };

const BULAN_LABEL: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "Mei", "06": "Jun",
  "07": "Jul", "08": "Agu", "09": "Sep", "10": "Okt", "11": "Nov", "12": "Des",
};
function labelPeriode(periode: string): string {
  const [tahun, bulan] = periode.split("-");
  return `${BULAN_LABEL[bulan!] ?? bulan} ${tahun}`;
}

export default function AnalitikGlobalPage() {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [jenjang, setJenjang] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [wilayah, setWilayah] = useState("");

  const [jumlahAttempt, setJumlahAttempt] = useState(0);
  const [perSekolah, setPerSekolah] = useState<PerSekolah[] | null>(null);
  const [kompetensi, setKompetensi] = useState<Kompetensi[] | null>(null);
  const [tren, setTren] = useState<Tren[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [schoolRes, subjectRes] = await Promise.all([
        fetch("/api/admin-pusat/schools"),
        fetch("/api/admin-pusat/subjects"),
      ]);
      const schoolData = await schoolRes.json().catch(() => null);
      const subjectData = await subjectRes.json().catch(() => null);
      if (!ignore) {
        setSchools(
          (schoolData?.schools ?? []).filter((s: { status: string }) => s.status === "aktif"),
        );
        setSubjects(subjectData?.subjects ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const timeout = setTimeout(async () => {
      const qs = new URLSearchParams();
      if (schoolId) qs.set("schoolId", schoolId);
      if (jenjang) qs.set("jenjang", jenjang);
      if (subjectId) qs.set("subjectId", subjectId);
      if (wilayah) qs.set("wilayah", wilayah);
      const res = await fetch(`/api/admin-pusat/analitik?${qs.toString()}`);
      const data = await res.json().catch(() => null);
      if (!ignore) {
        if (res.ok) {
          setJumlahAttempt(data.jumlahAttempt ?? 0);
          setPerSekolah(data.perSekolah ?? []);
          setKompetensi(data.kompetensi ?? []);
          setTren(data.tren ?? []);
          setError(null);
        } else {
          setError(data?.error ?? "Gagal memuat analitik.");
        }
      }
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(timeout);
    };
  }, [schoolId, jenjang, subjectId, wilayah]);

  const maxTren = Math.max(1, ...(tren?.map((t) => t.rataRata) ?? [1]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Analitik Global</h1>
        <p className="text-sm text-slate-500">
          Perbandingan antar sekolah & tren waktu, dari seluruh siswa Jalur A (sekolah aktif
          berlangganan).
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <Label htmlFor="filSekolah">Sekolah</Label>
          <select
            id="filSekolah"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
          >
            <option value="">Semua sekolah</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="filJenjang">Jenjang</Label>
          <select
            id="filJenjang"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={jenjang}
            onChange={(e) => setJenjang(e.target.value)}
          >
            <option value="">Semua jenjang</option>
            <option value="SD">SD</option>
            <option value="SMP">SMP</option>
          </select>
        </div>
        <div>
          <Label htmlFor="filMapel">Mapel</Label>
          <select
            id="filMapel"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">Semua mapel</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama} ({s.jenjang})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="filWilayah">Cari alamat/wilayah</Label>
          <Input
            id="filWilayah"
            placeholder='mis. "Madiun"'
            value={wilayah}
            onChange={(e) => setWilayah(e.target.value)}
            className="w-48"
          />
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!error && jumlahAttempt === 0 && perSekolah !== null && (
        <EmptyState
          title="Belum ada data"
          description="Belum ada ujian yang selesai dikerjakan untuk filter ini."
        />
      )}

      {jumlahAttempt > 0 && (
        <>
          <div>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Perbandingan Antar Sekolah</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="px-4 py-2 font-medium">Sekolah</th>
                    <th className="px-4 py-2 font-medium">Siswa aktif</th>
                    <th className="px-4 py-2 font-medium">Jumlah ujian</th>
                    <th className="px-4 py-2 font-medium">Rata-rata nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {perSekolah?.map((s, i) => (
                    <tr key={s.schoolId} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">{s.nama}</td>
                      <td className="px-4 py-2">{s.jumlahSiswaAktif}</td>
                      <td className="px-4 py-2">{s.jumlahAttempt}</td>
                      <td className="px-4 py-2">{s.rataRata.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Tren Bulanan</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Bulan</th>
                    <th className="px-4 py-2 font-medium">Jumlah ujian</th>
                    <th className="px-4 py-2 font-medium">Rata-rata nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {tren?.map((t) => (
                    <tr key={t.periode} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2">{labelPeriode(t.periode)}</td>
                      <td className="px-4 py-2">{t.jumlahAttempt}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-10 shrink-0">{t.rataRata.toFixed(1)}</span>
                          <div className="h-2 flex-1 max-w-xs rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-slate-500"
                              style={{ width: `${(t.rataRata / maxTren) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
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
