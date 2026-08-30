"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Label, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { TrendChart } from "@/components/ui/trend-chart";
import { IconChart } from "@/components/ui/empty-state-icons";
import { labelPeriodeBulan } from "@/lib/utils/datetime";

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

const selectClassName =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analitik Global"
        description="Perbandingan antar sekolah & tren waktu, dari seluruh siswa Jalur A (sekolah aktif berlangganan)."
      />

      <div className="flex flex-wrap gap-4">
        <div>
          <Label htmlFor="filSekolah">Sekolah</Label>
          <select
            id="filSekolah"
            className={selectClassName}
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
            className={selectClassName}
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
            className={selectClassName}
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

      {error && <Alert variant="danger">{error}</Alert>}

      {!error && jumlahAttempt === 0 && perSekolah !== null && (
        <EmptyState
          icon={<IconChart />}
          title="Belum ada data"
          description="Belum ada ujian yang selesai dikerjakan untuk filter ini."
        />
      )}

      {jumlahAttempt > 0 && (
        <>
          <div>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Perbandingan Antar Sekolah</h2>
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>#</Th>
                    <Th>Sekolah</Th>
                    <Th>Siswa aktif</Th>
                    <Th>Jumlah ujian</Th>
                    <Th>Rata-rata nilai</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {perSekolah?.map((s, i) => (
                    <Tr key={s.schoolId}>
                      <Td className="text-slate-500">{i + 1}</Td>
                      <Td className="font-medium text-slate-900">{s.nama}</Td>
                      <Td>{s.jumlahSiswaAktif}</Td>
                      <Td>{s.jumlahAttempt}</Td>
                      <Td>{s.rataRata.toFixed(1)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
          </div>

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
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Tren Bulanan</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
                <p className="mb-3 text-sm font-medium text-slate-700">Rata-rata nilai</p>
                <TrendChart
                  data={(tren ?? []).map((t) => ({ label: labelPeriodeBulan(t.periode), value: t.rataRata }))}
                  variant="area"
                  valueFormatter={(v) => v.toFixed(0)}
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
                <p className="mb-3 text-sm font-medium text-slate-700">Jumlah ujian</p>
                <TrendChart
                  data={(tren ?? []).map((t) => ({ label: labelPeriodeBulan(t.periode), value: t.jumlahAttempt }))}
                  variant="bar"
                  color="#0ea5e9"
                  valueFormatter={(v) => v.toFixed(0)}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
