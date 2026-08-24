"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

type ClassRow = {
  id: string;
  tingkat: number;
  namaRombel: string;
  waliKelas: { id: string; email: string; username: string | null } | null;
  academicYear: { nama: string };
  _count: { studentEnrollments: number };
};
type WaliOption = { id: string; email: string; username: string | null };
type AcademicYearOption = { id: string; nama: string; isActive: boolean };

export default function KelolaKelasPage() {
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [waliOptions, setWaliOptions] = useState<WaliOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [tingkat, setTingkat] = useState("");
  const [namaRombel, setNamaRombel] = useState("");
  const [waliKelasId, setWaliKelasId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [naikKelasResult, setNaikKelasResult] = useState<string | null>(null);
  const [naikKelasBusy, setNaikKelasBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeYear = academicYears.find((y) => y.isActive);
  const isViewingActiveYear = !selectedYearId || selectedYearId === activeYear?.id;

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [yearRes, waliRes] = await Promise.all([
        fetch("/api/admin-pusat/academic-years"),
        fetch("/api/admin-sekolah/wali-kelas-options"),
      ]);
      const yearData = await yearRes.json();
      const waliData = await waliRes.json();
      if (!ignore) {
        const years: AcademicYearOption[] = yearData.academicYears ?? [];
        setAcademicYears(years);
        setWaliOptions(waliData.options ?? []);
        setSelectedYearId((current) => current || years.find((y) => y.isActive)?.id || "");
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!selectedYearId) {
        setClasses(null);
        return;
      }
      const res = await fetch(`/api/admin-sekolah/kelas?academicYearId=${selectedYearId}`);
      const data = await res.json();
      if (!ignore) setClasses(data.classes ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [selectedYearId, refreshKey]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin-sekolah/kelas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tingkat, namaRombel, waliKelasId }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal membuat rombel.");
      return;
    }

    setTingkat("");
    setNamaRombel("");
    setWaliKelasId("");
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(id: string, label: string) {
    if (!window.confirm(`Hapus rombel "${label}"?`)) return;
    const res = await fetch(`/api/admin-sekolah/kelas/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      alert(data?.error ?? "Gagal menghapus rombel.");
    }
  }

  async function handleNaikKelas() {
    if (
      !window.confirm(
        "Naikkan semua siswa ke tingkat/rombel berikutnya di tahun ajaran aktif? Siswa di tingkat akhir akan ditandai lulus (nonaktif). Riwayat nilai tidak akan hilang.",
      )
    ) {
      return;
    }
    setNaikKelasBusy(true);
    setNaikKelasResult(null);
    const res = await fetch("/api/admin-sekolah/kelas/naik-kelas", { method: "POST" });
    const data = await res.json().catch(() => null);
    setNaikKelasBusy(false);

    if (!res.ok || !data) {
      setNaikKelasResult(data?.error ?? "Gagal menaikkan kelas. Coba muat ulang halaman lalu ulangi.");
      return;
    }
    setNaikKelasResult(
      `Berhasil: ${data.dipindah} siswa naik ke rombel berikutnya, ${data.diluluskan} siswa ditandai lulus.`,
    );
    setSelectedYearId(activeYear?.id ?? selectedYearId);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Kelola Kelas/Rombel</h1>
          <p className="text-sm text-slate-500">
            Riwayat rombel &amp; siswa tiap tahun ajaran tetap tersimpan - pilih tahun ajaran di
            bawah untuk melihatnya.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleNaikKelas} disabled={naikKelasBusy}>
            {naikKelasBusy ? "Memproses..." : "Naik Kelas massal"}
          </Button>
          <Button onClick={() => setShowForm((v) => !v)} disabled={!isViewingActiveYear}>
            {showForm ? "Batal" : "Tambah rombel"}
          </Button>
        </div>
      </div>

      <div className="w-64">
        <Label htmlFor="yearSelect">Tahun ajaran</Label>
        <select
          id="yearSelect"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={selectedYearId}
          onChange={(e) => setSelectedYearId(e.target.value)}
        >
          {academicYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.nama}
              {y.isActive ? " (aktif)" : ""}
            </option>
          ))}
        </select>
      </div>

      {!isViewingActiveYear && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
          Ini arsip tahun ajaran lama, hanya bisa dilihat. Rombel baru cuma bisa ditambah di tahun
          ajaran yang aktif ({activeYear?.nama ?? "-"}).
        </p>
      )}

      {naikKelasResult && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{naikKelasResult}</p>
      )}

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          {error && (
            <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div className="w-24">
            <Label htmlFor="tingkat">Tingkat</Label>
            <Input
              id="tingkat"
              type="number"
              min={1}
              max={12}
              required
              value={tingkat}
              onChange={(e) => setTingkat(e.target.value)}
            />
          </div>
          <div className="w-32">
            <Label htmlFor="namaRombel">Nama rombel</Label>
            <Input
              id="namaRombel"
              required
              placeholder="mis. 7A"
              value={namaRombel}
              onChange={(e) => setNamaRombel(e.target.value)}
            />
          </div>
          <div className="w-56">
            <Label htmlFor="waliKelasId">Wali kelas (opsional)</Label>
            <select
              id="waliKelasId"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={waliKelasId}
              onChange={(e) => setWaliKelasId(e.target.value)}
            >
              <option value="">Belum ditentukan</option>
              {waliOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.username ?? w.email}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      )}

      {classes === null && <p className="text-sm text-slate-500">Memuat...</p>}
      {classes?.length === 0 && isViewingActiveYear && (
        <EmptyState
          title="Belum ada rombel di tahun ajaran ini"
          description='Kalau ini tahun ajaran baru dan siswa sudah ada di tahun sebelumnya, klik "Naik Kelas massal" di atas untuk memindahkan rombel & siswa secara otomatis. Atau tambah rombel baru dari awal.'
          action={<Button onClick={() => setShowForm(true)}>Tambah rombel</Button>}
        />
      )}
      {classes?.length === 0 && !isViewingActiveYear && (
        <EmptyState
          title="Belum ada rombel di tahun ajaran ini"
          description="Sekolah belum punya rombel yang tercatat untuk tahun ajaran ini."
        />
      )}

      {classes && classes.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Tingkat</th>
                <th className="px-4 py-2 font-medium">Rombel</th>
                <th className="px-4 py-2 font-medium">Wali kelas</th>
                <th className="px-4 py-2 font-medium">Siswa</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{c.tingkat}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{c.namaRombel}</td>
                  <td className="px-4 py-2">{c.waliKelas ? (c.waliKelas.username ?? c.waliKelas.email) : "-"}</td>
                  <td className="px-4 py-2">{c._count.studentEnrollments}</td>
                  <td className="px-4 py-2 text-right">
                    {isViewingActiveYear && (
                      <button
                        onClick={() => handleDelete(c.id, `${c.tingkat}${c.namaRombel}`)}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Hapus
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
