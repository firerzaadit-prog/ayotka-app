"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

type AcademicYear = { id: string; nama: string; mulai: string; selesai: string; isActive: boolean };

export default function TahunAjaranPage() {
  const [years, setYears] = useState<AcademicYear[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [nama, setNama] = useState("");
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/academic-years");
      const data = await res.json();
      if (!ignore) setYears(data.academicYears ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin-pusat/academic-years", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama, mulai, selesai }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal membuat tahun ajaran.");
      return;
    }

    setNama("");
    setMulai("");
    setSelesai("");
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Tahun Ajaran</h1>
          <p className="text-sm text-slate-500">
            Berlaku untuk semua sekolah. Membuat tahun ajaran baru otomatis menjadikannya aktif -
            dipakai sebagai tujuan tombol &quot;Naik Kelas&quot; di tiap sekolah.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Batal" : "Buat tahun ajaran"}</Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          {error && (
            <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div className="flex-1">
            <Label htmlFor="nama">Nama</Label>
            <Input
              id="nama"
              required
              placeholder='mis. "2027/2028"'
              value={nama}
              onChange={(e) => setNama(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="mulai">Mulai</Label>
            <Input id="mulai" type="date" required value={mulai} onChange={(e) => setMulai(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="selesai">Selesai</Label>
            <Input
              id="selesai"
              type="date"
              required
              value={selesai}
              onChange={(e) => setSelesai(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan & aktifkan"}
          </Button>
        </form>
      )}

      {years === null && <p className="text-sm text-slate-500">Memuat...</p>}
      {years?.length === 0 && (
        <EmptyState
          title="Belum ada tahun ajaran"
          description="Buat tahun ajaran pertama supaya sekolah bisa membuat kelas/rombel."
          action={<Button onClick={() => setShowForm(true)}>Buat tahun ajaran</Button>}
        />
      )}

      {years && years.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-4 py-2 font-medium">Mulai</th>
                <th className="px-4 py-2 font-medium">Selesai</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-900">{y.nama}</td>
                  <td className="px-4 py-2">{new Date(y.mulai).toLocaleDateString("id-ID")}</td>
                  <td className="px-4 py-2">{new Date(y.selesai).toLocaleDateString("id-ID")}</td>
                  <td className="px-4 py-2">
                    {y.isActive && (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Aktif
                      </span>
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
