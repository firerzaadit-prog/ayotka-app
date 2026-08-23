"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

type SchoolListItem = {
  id: string;
  nama: string;
  jenjang: "SD" | "SMP";
  kodeSekolah: string;
  status: string;
  kuotaSiswa: number;
  _count: { schoolUsers: number; students: number };
};

type SchoolFormState = {
  nama: string;
  npsn: string;
  jenjang: "SD" | "SMP";
  alamat: string;
  kuotaSiswa: string;
};

const emptyForm: SchoolFormState = { nama: "", npsn: "", jenjang: "SD", alamat: "", kuotaSiswa: "" };

export default function SekolahPage() {
  const [schools, setSchools] = useState<SchoolListItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SchoolFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
  }, [refreshKey]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin-pusat/schools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Gagal menyimpan sekolah.");
      return;
    }

    setCreatedCode(data.school.kodeSekolah);
    setForm(emptyForm);
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Sekolah</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Batal" : "Tambah sekolah"}
        </Button>
      </div>

      {createdCode && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Sekolah berhasil dibuat. Kode Sekolah: <strong>{createdCode}</strong> — sampaikan
          kode ini ke sekolah untuk proses registrasi siswa.
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
        >
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div>
            <Label htmlFor="nama">Nama sekolah</Label>
            <Input
              id="nama"
              required
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="jenjang">Jenjang</Label>
              <select
                id="jenjang"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.jenjang}
                onChange={(e) =>
                  setForm({ ...form, jenjang: e.target.value as "SD" | "SMP" })
                }
              >
                <option value="SD">SD</option>
                <option value="SMP">SMP</option>
              </select>
            </div>
            <div>
              <Label htmlFor="npsn">NPSN (opsional)</Label>
              <Input
                id="npsn"
                value={form.npsn}
                onChange={(e) => setForm({ ...form, npsn: e.target.value })}
                placeholder="8 digit"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="alamat">Alamat (opsional)</Label>
            <Input
              id="alamat"
              value={form.alamat}
              onChange={(e) => setForm({ ...form, alamat: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="kuotaSiswa">Kuota siswa</Label>
            <Input
              id="kuotaSiswa"
              type="number"
              min={1}
              required
              value={form.kuotaSiswa}
              onChange={(e) => setForm({ ...form, kuotaSiswa: e.target.value })}
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? "Menyimpan..." : "Simpan sekolah"}
          </Button>
        </form>
      )}

      {schools === null && <p className="text-sm text-slate-500">Memuat...</p>}

      {schools?.length === 0 && (
        <EmptyState
          title="Belum ada sekolah"
          description="Tambah sekolah pertama untuk mulai mengelola akun admin sekolah dan siswanya."
          action={<Button onClick={() => setShowForm(true)}>Tambah sekolah</Button>}
        />
      )}

      {schools && schools.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-4 py-2 font-medium">Jenjang</th>
                <th className="px-4 py-2 font-medium">Kode Sekolah</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Admin</th>
                <th className="px-4 py-2 font-medium">Siswa</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin-pusat/sekolah/${school.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {school.nama}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{school.jenjang}</td>
                  <td className="px-4 py-2 font-mono">{school.kodeSekolah}</td>
                  <td className="px-4 py-2">{school.status}</td>
                  <td className="px-4 py-2">{school._count.schoolUsers}</td>
                  <td className="px-4 py-2">
                    {school._count.students}/{school.kuotaSiswa}
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
