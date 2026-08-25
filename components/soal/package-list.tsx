"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

type Subject = { id: string; nama: string; jenjang: "SD" | "SMP" };
type BlueprintOption = { id: string; nama: string; jenjang: "SD" | "SMP"; tingkat: number };
type PackageListItem = {
  id: string;
  nama: string;
  jenjang: "SD" | "SMP";
  tingkat: number;
  status: string;
  jumlahSoal: number;
  subject: Subject;
  _count: { questions: number };
};

const emptyForm = {
  subjectId: "",
  nama: "",
  jenjang: "SD" as "SD" | "SMP",
  tingkat: "",
  durasiMenit: "",
  jumlahSoal: "",
  blueprintId: "",
  modePembahasan: "setelah_tutup" as "langsung" | "setelah_tutup",
  bolehDipilihSiswa: false,
};

export function PackageList({ basePath }: { basePath: string }) {
  const [packages, setPackages] = useState<PackageListItem[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [blueprints, setBlueprints] = useState<BlueprintOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [pkgRes, subjectRes] = await Promise.all([
        fetch("/api/packages"),
        fetch("/api/admin-pusat/subjects"),
      ]);
      const pkgData = await pkgRes.json();
      const subjectData = await subjectRes.json();
      if (!ignore) {
        setPackages(pkgData.packages ?? []);
        setSubjects(subjectData.subjects ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!form.subjectId) {
        if (!ignore) setBlueprints([]);
        return;
      }
      const res = await fetch(`/api/blueprints?subjectId=${form.subjectId}`);
      const data = await res.json();
      if (!ignore) setBlueprints(data.blueprints ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [form.subjectId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Gagal menyimpan paket.");
      return;
    }

    setForm(emptyForm);
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(packageId: string, nama: string) {
    if (!window.confirm(`Hapus paket "${nama}"? Soal & riwayatnya tetap aman, cuma paket ini yang diarsipkan.`)) {
      return;
    }
    const res = await fetch(`/api/packages/${packageId}`, { method: "DELETE" });
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Bank Soal</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Batal" : "Buat paket"}</Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
        >
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div>
            <Label htmlFor="nama">Nama paket</Label>
            <Input
              id="nama"
              required
              placeholder='mis. "Paket A"'
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="subjectId">Mapel</Label>
              <select
                id="subjectId"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.subjectId}
                onChange={(e) => {
                  const subject = subjects.find((s) => s.id === e.target.value);
                  setForm({
                    ...form,
                    subjectId: e.target.value,
                    jenjang: subject?.jenjang ?? form.jenjang,
                    blueprintId: "",
                  });
                }}
              >
                <option value="">Pilih mapel</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.jenjang})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="tingkat">Tingkat kelas</Label>
              <Input
                id="tingkat"
                type="number"
                min={1}
                max={12}
                required
                value={form.tingkat}
                onChange={(e) => setForm({ ...form, tingkat: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="durasiMenit">Durasi (menit)</Label>
              <Input
                id="durasiMenit"
                type="number"
                min={1}
                required
                value={form.durasiMenit}
                onChange={(e) => setForm({ ...form, durasiMenit: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="jumlahSoal">Target jumlah soal</Label>
              <Input
                id="jumlahSoal"
                type="number"
                min={1}
                required
                value={form.jumlahSoal}
                onChange={(e) => setForm({ ...form, jumlahSoal: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="blueprintId">Kisi-kisi (opsional)</Label>
            <select
              id="blueprintId"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.blueprintId}
              onChange={(e) => setForm({ ...form, blueprintId: e.target.value })}
            >
              <option value="">Tanpa kisi-kisi</option>
              {blueprints
                .filter((b) => b.jenjang === form.jenjang && String(b.tingkat) === form.tingkat)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nama}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <Label htmlFor="modePembahasan">Tampilkan pembahasan</Label>
            <select
              id="modePembahasan"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.modePembahasan}
              onChange={(e) =>
                setForm({
                  ...form,
                  modePembahasan: e.target.value as "langsung" | "setelah_tutup",
                })
              }
            >
              <option value="setelah_tutup">Setelah jendela ujian ditutup (aman dari bocor ke teman sekelas)</option>
              <option value="langsung">Langsung setelah siswa submit</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.bolehDipilihSiswa}
              onChange={(e) => setForm({ ...form, bolehDipilihSiswa: e.target.checked })}
            />
            Boleh dipilih bebas siswa (Latihan Mandiri)
          </label>
          <p className="text-xs text-slate-500">
            Kalau aktif, siswa bisa memilih paket ini sendiri lewat menu Latihan Mandiri
            (di luar jadwal ujian) - selama paket sudah di-publish dan distribusinya
            (lihat halaman detail paket) mengizinkan siswa tersebut melihatnya.
          </p>
          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? "Menyimpan..." : "Simpan paket"}
          </Button>
        </form>
      )}

      {packages === null && <p className="text-sm text-slate-500">Memuat...</p>}

      {packages?.length === 0 && (
        <EmptyState
          title="Belum ada paket soal"
          description="Buat paket pertama, lalu tambahkan soal ke dalamnya."
          action={<Button onClick={() => setShowForm(true)}>Buat paket</Button>}
        />
      )}

      {packages && packages.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-4 py-2 font-medium">Mapel</th>
                <th className="px-4 py-2 font-medium">Tingkat</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Soal</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`${basePath}/${pkg.id}`} className="font-medium text-slate-900 hover:underline">
                      {pkg.nama}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{pkg.subject.nama}</td>
                  <td className="px-4 py-2">{pkg.tingkat}</td>
                  <td className="px-4 py-2">{pkg.status}</td>
                  <td className="px-4 py-2">
                    {pkg._count.questions}/{pkg.jumlahSoal}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(pkg.id, pkg.nama)}
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
