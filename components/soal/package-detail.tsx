"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PackageDistribution } from "@/components/soal/package-distribution";

type Question = {
  id: string;
  format: string;
  teks: string;
  tingkatKesulitan: string;
  kompetensi: { kode: string };
  _count: { attemptAnswers: number };
};

type Subject = { id: string; nama: string; jenjang: "SD" | "SMP" };

type PackageDetail = {
  id: string;
  nama: string;
  status: string;
  jenjang: "SD" | "SMP";
  tingkat: number;
  durasiMenit: number;
  jumlahSoal: number;
  subjectId: string;
  ownerType: "pusat" | "sekolah";
  blueprint: { id: string; nama: string; totalSoal: number } | null;
  questions: Question[];
};

type EditForm = {
  nama: string;
  subjectId: string;
  jenjang: "SD" | "SMP";
  tingkat: string;
  durasiMenit: string;
  jumlahSoal: string;
};

function toEditForm(pkg: PackageDetail): EditForm {
  return {
    nama: pkg.nama,
    subjectId: pkg.subjectId,
    jenjang: pkg.jenjang,
    tingkat: String(pkg.tingkat),
    durasiMenit: String(pkg.durasiMenit),
    jumlahSoal: String(pkg.jumlahSoal),
  };
}

const FORMAT_LABEL: Record<string, string> = {
  pg: "PG",
  pg_kompleks: "PG Kompleks",
  pg_kategori: "PG Kategori",
};

export function PackageDetail({
  packageId,
  basePath,
}: {
  packageId: string;
  basePath: string;
}) {
  const [pkg, setPkg] = useState<PackageDetail | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [pkgRes, subjectRes] = await Promise.all([
        fetch(`/api/packages/${packageId}`),
        fetch("/api/admin-pusat/subjects"),
      ]);
      const data = await pkgRes.json();
      const subjectData = await subjectRes.json();
      if (!ignore) {
        setPkg(data.package);
        setSubjects(subjectData.subjects ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [packageId, refreshKey]);

  function handleOpenEdit() {
    if (pkg) setEditForm(toEditForm(pkg));
    setEditError(null);
    setShowEditForm(true);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editForm) return;
    setEditError(null);
    setEditSubmitting(true);

    const res = await fetch(`/api/packages/${packageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const data = await res.json().catch(() => null);
    setEditSubmitting(false);

    if (!res.ok) {
      setEditError(data?.error ?? "Gagal menyimpan perubahan.");
      return;
    }
    setShowEditForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handlePublish() {
    setPublishError(null);
    setPublishing(true);
    const res = await fetch(`/api/packages/${packageId}/publish`, { method: "POST" });
    const data = await res.json();
    setPublishing(false);

    if (!res.ok) {
      setPublishError(data.error ?? "Gagal publish.");
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  async function handleDeleteQuestion(questionId: string) {
    if (
      !window.confirm(
        "Hapus soal ini? Soal hilang dari daftar, tapi riwayat jawaban siswa (kalau ada) tetap aman.",
      )
    ) {
      return;
    }
    const res = await fetch(`/api/questions/${questionId}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      alert(data?.error ?? "Gagal menghapus soal.");
    }
  }

  if (!pkg) return <p className="text-sm text-slate-500">Memuat...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={basePath} className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke Bank Soal
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{pkg.nama}</h1>
            <p className="text-sm text-slate-500">
              Status: {pkg.status} · {pkg.questions.length}/{pkg.jumlahSoal} soal
              {pkg.blueprint && ` · Kisi-kisi: ${pkg.blueprint.nama}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleOpenEdit}>
              Edit
            </Button>
            <Link
              href={`${basePath}/${packageId}/soal/baru`}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Tambah soal
            </Link>
            {pkg.status !== "published" && (
              <Button onClick={handlePublish} disabled={publishing}>
                {publishing ? "Memproses..." : "Publish"}
              </Button>
            )}
          </div>
        </div>

        {showEditForm && editForm && (
          <form
            onSubmit={handleEditSubmit}
            className="mt-4 flex max-w-xl flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
          >
            {editError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</p>
            )}
            <div>
              <Label htmlFor="editPkgNama">Nama paket</Label>
              <Input
                id="editPkgNama"
                required
                value={editForm.nama}
                onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editPkgSubject">Mapel</Label>
                <select
                  id="editPkgSubject"
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={editForm.subjectId}
                  onChange={(e) => {
                    const subject = subjects.find((s) => s.id === e.target.value);
                    setEditForm({
                      ...editForm,
                      subjectId: e.target.value,
                      jenjang: subject?.jenjang ?? editForm.jenjang,
                    });
                  }}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.jenjang})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="editPkgTingkat">Tingkat kelas</Label>
                <Input
                  id="editPkgTingkat"
                  type="number"
                  min={1}
                  max={12}
                  required
                  value={editForm.tingkat}
                  onChange={(e) => setEditForm({ ...editForm, tingkat: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editPkgDurasi">Durasi (menit)</Label>
                <Input
                  id="editPkgDurasi"
                  type="number"
                  min={1}
                  required
                  value={editForm.durasiMenit}
                  onChange={(e) => setEditForm({ ...editForm, durasiMenit: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editPkgJumlah">Target jumlah soal</Label>
                <Input
                  id="editPkgJumlah"
                  type="number"
                  min={1}
                  required
                  value={editForm.jumlahSoal}
                  onChange={(e) => setEditForm({ ...editForm, jumlahSoal: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? "Menyimpan..." : "Simpan perubahan"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowEditForm(false)}>
                Batal
              </Button>
            </div>
          </form>
        )}
      </div>

      {publishError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{publishError}</p>
      )}

      {pkg.questions.length === 0 ? (
        <EmptyState
          title="Belum ada soal"
          description="Tambah soal pertama untuk paket ini."
          action={
            <Link
              href={`${basePath}/${packageId}/soal/baru`}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Tambah soal
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Soal</th>
                <th className="px-4 py-2 font-medium">Format</th>
                <th className="px-4 py-2 font-medium">Kesulitan</th>
                <th className="px-4 py-2 font-medium">Kompetensi</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {pkg.questions.map((q) => (
                <tr key={q.id} className="border-b border-slate-100 last:border-0">
                  <td className="max-w-sm truncate px-4 py-2">{q.teks}</td>
                  <td className="px-4 py-2">{FORMAT_LABEL[q.format] ?? q.format}</td>
                  <td className="px-4 py-2">{q.tingkatKesulitan}</td>
                  <td className="px-4 py-2 font-mono text-xs">{q.kompetensi.kode}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`${basePath}/${packageId}/soal/${q.id}`}
                        className="text-sm font-medium text-slate-600 hover:text-slate-900"
                      >
                        {q._count.attemptAnswers > 0 ? "Lihat" : "Edit"}
                      </Link>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pkg.ownerType === "pusat" && <PackageDistribution packageId={packageId} />}
    </div>
  );
}
