"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

type SchoolOption = { id: string; nama: string };
type ClassOption = { id: string; tingkat: number; namaRombel: string };
type StudentRow = {
  id: string;
  nama: string;
  nisn: string | null;
  jalur: "A" | "B";
  claimStatus: "belum_klaim" | "sudah_klaim";
  status: "pending" | "active" | "nonaktif";
  school: { id: string; nama: string } | null;
  enrollments: { class: { tingkat: number; namaRombel: string } }[];
};

const JALUR_LABEL: Record<string, string> = { A: "Jalur A (sekolah)", B: "Jalur B (mandiri)" };
const CLAIM_LABEL: Record<string, string> = {
  belum_klaim: "Belum klaim",
  sudah_klaim: "Sudah klaim",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  active: "Aktif",
  nonaktif: "Nonaktif",
};

export default function SemuaSiswaPage() {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [filterSchoolId, setFilterSchoolId] = useState("");
  const [filterJalur, setFilterJalur] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [formSchoolId, setFormSchoolId] = useState("");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [nama, setNama] = useState("");
  const [nisn, setNisn] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/schools");
      const data = await res.json();
      if (!ignore) setSchools(data.schools ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const params = new URLSearchParams();
      if (filterSchoolId) params.set("schoolId", filterSchoolId);
      if (filterJalur) params.set("jalur", filterJalur);
      const res = await fetch(`/api/admin-pusat/siswa?${params.toString()}`);
      const data = await res.json();
      if (!ignore) setStudents(data.students ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [filterSchoolId, filterJalur, refreshKey]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!formSchoolId) {
        if (!ignore) {
          setClasses([]);
          setClassId("");
        }
        return;
      }
      const res = await fetch(`/api/admin-sekolah/kelas?schoolId=${formSchoolId}`);
      const data = await res.json();
      if (!ignore) {
        setClasses(data.classes ?? []);
        setClassId("");
      }
    })();
    return () => {
      ignore = true;
    };
  }, [formSchoolId]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!classId) {
      setError("Pilih sekolah & rombel dulu.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin-sekolah/siswa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama, nisn, tanggalLahir, classId }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal menambah siswa.");
      return;
    }

    setNama("");
    setNisn("");
    setTanggalLahir("");
    setFormSchoolId("");
    setClassId("");
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(id: string, namaSiswa: string) {
    if (!window.confirm(`Hapus siswa "${namaSiswa}"? Riwayat nilai tetap tersimpan.`)) return;
    const res = await fetch(`/api/admin-sekolah/siswa/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      alert(data?.error ?? "Gagal menghapus siswa.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Semua Siswa</h1>
          <p className="text-sm text-slate-500">
            Gabungan siswa Jalur A (kerja sama sekolah) dan Jalur B (mandiri) di semua sekolah.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Batal" : "Tambah siswa"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-64">
          <Label htmlFor="filterSchool">Filter sekolah</Label>
          <select
            id="filterSchool"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={filterSchoolId}
            onChange={(e) => setFilterSchoolId(e.target.value)}
          >
            <option value="">Semua sekolah</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
          </select>
        </div>
        <div className="w-48">
          <Label htmlFor="filterJalur">Filter jalur</Label>
          <select
            id="filterJalur"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={filterJalur}
            onChange={(e) => setFilterJalur(e.target.value)}
          >
            <option value="">Semua jalur</option>
            <option value="A">Jalur A (sekolah)</option>
            <option value="B">Jalur B (mandiri)</option>
          </select>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
        >
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <p className="text-xs text-slate-500">
            Menambah siswa lewat sini selalu Jalur A (siswa dapat kode klaim) — untuk Jalur B,
            siswa mendaftar mandiri sendiri lewat halaman registrasi.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="formSchool">Sekolah</Label>
              <select
                id="formSchool"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={formSchoolId}
                onChange={(e) => setFormSchoolId(e.target.value)}
              >
                <option value="">Pilih sekolah</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="formClass">Rombel</Label>
              <select
                id="formClass"
                required
                disabled={!formSchoolId}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">{formSchoolId ? "Pilih rombel" : "Pilih sekolah dulu"}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.tingkat}
                    {c.namaRombel}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nama">Nama</Label>
              <Input id="nama" required value={nama} onChange={(e) => setNama(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="nisn">NISN (opsional)</Label>
              <Input id="nisn" value={nisn} onChange={(e) => setNisn(e.target.value)} />
            </div>
          </div>
          <div className="w-48">
            <Label htmlFor="tanggalLahir">Tanggal lahir</Label>
            <Input
              id="tanggalLahir"
              type="date"
              value={tanggalLahir}
              onChange={(e) => setTanggalLahir(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      )}

      {students === null && <p className="text-sm text-slate-500">Memuat...</p>}
      {students?.length === 0 && (
        <EmptyState
          title="Belum ada siswa"
          description="Tidak ada siswa yang cocok dengan filter ini."
        />
      )}

      {students && students.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-4 py-2 font-medium">Sekolah</th>
                <th className="px-4 py-2 font-medium">Jalur</th>
                <th className="px-4 py-2 font-medium">Rombel</th>
                <th className="px-4 py-2 font-medium">Klaim</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-900">{s.nama}</td>
                  <td className="px-4 py-2">{s.school?.nama ?? "-"}</td>
                  <td className="px-4 py-2">{JALUR_LABEL[s.jalur]}</td>
                  <td className="px-4 py-2">
                    {s.enrollments[0]
                      ? `${s.enrollments[0].class.tingkat}${s.enrollments[0].class.namaRombel}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2">{CLAIM_LABEL[s.claimStatus]}</td>
                  <td className="px-4 py-2">{STATUS_LABEL[s.status]}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(s.id, s.nama)}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      Hapus
                    </button>
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
