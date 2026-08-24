"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { formatWIBDate } from "@/lib/utils/datetime";

type ClassOption = { id: string; tingkat: number; namaRombel: string };
type PackageOption = { id: string; nama: string; jumlahSoal: number; durasiMenit: number };
type AssignmentRow = {
  id: string;
  mulai: string;
  selesai: string;
  metodeDistribusi: "otomatis" | "manual";
  isActive: boolean;
  package: { nama: string; jumlahSoal: number; durasiMenit: number };
  class: { tingkat: number; namaRombel: string } | null;
  _count: { attempts: number };
};

const METODE_LABEL: Record<string, string> = { otomatis: "Otomatis (bergilir)", manual: "Manual" };

export default function UjianPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [classId, setClassId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  const [metodeDistribusi, setMetodeDistribusi] = useState<"otomatis" | "manual">("otomatis");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [classRes, pkgRes] = await Promise.all([
        fetch("/api/admin-sekolah/kelas"),
        fetch("/api/admin-sekolah/paket-tersedia"),
      ]);
      const classData = await classRes.json();
      const pkgData = await pkgRes.json();
      if (!ignore) {
        setClasses(classData.classes ?? []);
        setPackages(pkgData.packages ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-sekolah/assignments");
      const data = await res.json();
      if (!ignore) setAssignments(data.assignments ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin-sekolah/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, packageId, mulai, selesai, metodeDistribusi }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal membuat penugasan.");
      return;
    }

    setClassId("");
    setPackageId("");
    setMulai("");
    setSelesai("");
    setMetodeDistribusi("otomatis");
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleToggleActive(assignment: AssignmentRow) {
    await fetch(`/api/admin-sekolah/assignments/${assignment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !assignment.isActive }),
    });
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Penugasan Ujian</h1>
          <p className="text-sm text-slate-500">
            Tugaskan paket soal ke satu rombel dalam jendela waktu tertentu.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Batal" : "Buat penugasan"}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
        >
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="packageId">Paket soal</Label>
              <select
                id="packageId"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
              >
                <option value="">Pilih paket</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} ({p.jumlahSoal} soal, {p.durasiMenit} menit)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="classId">Rombel</Label>
              <select
                id="classId"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">Pilih rombel</option>
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
              <Label htmlFor="mulai">Mulai</Label>
              <Input
                id="mulai"
                type="datetime-local"
                required
                value={mulai}
                onChange={(e) => setMulai(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="selesai">Selesai</Label>
              <Input
                id="selesai"
                type="datetime-local"
                required
                value={selesai}
                onChange={(e) => setSelesai(e.target.value)}
              />
            </div>
          </div>
          <div className="w-64">
            <Label htmlFor="metodeDistribusi">Metode distribusi</Label>
            <select
              id="metodeDistribusi"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={metodeDistribusi}
              onChange={(e) => setMetodeDistribusi(e.target.value as "otomatis" | "manual")}
            >
              <option value="otomatis">Otomatis (bergilir antar paket paralel)</option>
              <option value="manual">Manual (semua siswa dapat paket ini persis)</option>
            </select>
          </div>
          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? "Menyimpan..." : "Simpan penugasan"}
          </Button>
        </form>
      )}

      {assignments === null && <p className="text-sm text-slate-500">Memuat...</p>}
      {assignments?.length === 0 && (
        <EmptyState
          title="Belum ada penugasan ujian"
          description="Buat penugasan pertama untuk mulai memberi ujian ke satu rombel."
          action={<Button onClick={() => setShowForm(true)}>Buat penugasan</Button>}
        />
      )}

      {assignments && assignments.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Paket</th>
                <th className="px-4 py-2 font-medium">Rombel</th>
                <th className="px-4 py-2 font-medium">Jendela waktu</th>
                <th className="px-4 py-2 font-medium">Distribusi</th>
                <th className="px-4 py-2 font-medium">Attempt</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <Link href={`/admin-sekolah/ujian/${a.id}`} className="hover:underline">
                      {a.package.nama}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {a.class ? `${a.class.tingkat}${a.class.namaRombel}` : "-"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {formatWIBDate(a.mulai)} — {formatWIBDate(a.selesai)}
                  </td>
                  <td className="px-4 py-2">{METODE_LABEL[a.metodeDistribusi]}</td>
                  <td className="px-4 py-2">{a._count.attempts}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        a.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {a.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleToggleActive(a)}
                      className="text-sm font-medium text-slate-600 hover:text-slate-900"
                    >
                      {a.isActive ? "Nonaktifkan" : "Aktifkan"}
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
