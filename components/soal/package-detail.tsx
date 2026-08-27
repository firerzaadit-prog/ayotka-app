"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, buttonClassName } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { PackageDistribution } from "@/components/soal/package-distribution";

/** Bersihkan simbol LaTeX untuk preview singkat di tabel */
function stripLatex(text: string): string {
  return text
    .replace(/\$\$[^$]*\$\$/g, "[rumus]") // block math
    .replace(/\$[^$]*\$/g, "[rumus]")       // inline math
    .replace(/\\[a-zA-Z]+/g, "")            // perintah LaTeX seperti \div \frac
    .replace(/[{}]/g, "")                    // kurung kurawal LaTeX
    .replace(/\s+/g, " ")                    // normalisasi spasi
    .trim();
}

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
  modePembahasan: "langsung" | "setelah_tutup";
  bolehDipilihSiswa: boolean;
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
  modePembahasan: "langsung" | "setelah_tutup";
  bolehDipilihSiswa: boolean;
};

const MODE_PEMBAHASAN_LABEL: Record<"langsung" | "setelah_tutup", string> = {
  langsung: "Langsung setelah siswa submit",
  setelah_tutup: "Setelah jendela ujian ditutup",
};

const STATUS_BADGE_VARIANT: Record<string, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
};

const selectClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

function toEditForm(pkg: PackageDetail): EditForm {
  return {
    nama: pkg.nama,
    subjectId: pkg.subjectId,
    jenjang: pkg.jenjang,
    tingkat: String(pkg.tingkat),
    durasiMenit: String(pkg.durasiMenit),
    jumlahSoal: String(pkg.jumlahSoal),
    modePembahasan: pkg.modePembahasan,
    bolehDipilihSiswa: pkg.bolehDipilihSiswa,
  };
}

const FORMAT_LABEL: Record<string, string> = {
  pg: "PG",
  pg_kompleks: "PG Kompleks",
  pg_kategori: "PG Kategori",
};

const FORMAT_COLOR: Record<string, string> = {
  pg: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  pg_kompleks: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  pg_kategori: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
};

const KESULITAN_COLOR: Record<string, string> = {
  mudah: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  sedang: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  sulit: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
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
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{pkg.nama}</h1>
          <Badge variant={STATUS_BADGE_VARIANT[pkg.status] ?? "neutral"}>{pkg.status}</Badge>
        </div>
        <p className="text-sm text-slate-500">
          {pkg.questions.length}/{pkg.jumlahSoal} soal
          {pkg.blueprint && ` · Kisi-kisi: ${pkg.blueprint.nama}`}
          {" · Pembahasan: "}
          {MODE_PEMBAHASAN_LABEL[pkg.modePembahasan]}
          {" · Latihan Mandiri: "}
          {pkg.bolehDipilihSiswa ? "aktif" : "nonaktif"}
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleOpenEdit}>
            Edit
          </Button>
          <Link href={`${basePath}/${packageId}/soal/baru`} className={buttonClassName("primary")}>
            Tambah soal
          </Link>
          {pkg.status !== "published" && (
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? "Memproses..." : "Publish"}
            </Button>
          )}
        </div>

        {showEditForm && editForm && (
          <Card className="mt-4 max-w-xl">
            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              {editError && <Alert variant="danger">{editError}</Alert>}
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
                    className={selectClassName}
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
              <div>
                <Label htmlFor="editPkgPembahasan">Tampilkan pembahasan</Label>
                <select
                  id="editPkgPembahasan"
                  className={selectClassName}
                  value={editForm.modePembahasan}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      modePembahasan: e.target.value as "langsung" | "setelah_tutup",
                    })
                  }
                >
                  <option value="setelah_tutup">
                    Setelah jendela ujian ditutup (aman dari bocor ke teman sekelas)
                  </option>
                  <option value="langsung">Langsung setelah siswa submit</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editForm.bolehDipilihSiswa}
                    onChange={(e) =>
                      setEditForm({ ...editForm, bolehDipilihSiswa: e.target.checked })
                    }
                    className="accent-indigo-600"
                  />
                  Boleh dipilih bebas siswa (Latihan Mandiri)
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Kalau aktif, siswa bisa memilih paket ini sendiri lewat menu Latihan Mandiri
                  (di luar jadwal ujian) - selama paket sudah di-publish dan distribusinya
                  (lihat bagian &quot;Distribusi ke Sekolah&quot; di bawah) mengizinkan siswa
                  tersebut melihatnya.
                </p>
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
          </Card>
        )}
      </div>

      {publishError && <Alert variant="danger">{publishError}</Alert>}

      {pkg.questions.length === 0 ? (
        <EmptyState
          title="Belum ada soal"
          description="Tambah soal pertama untuk paket ini."
          action={
            <Link href={`${basePath}/${packageId}/soal/baru`} className={buttonClassName("primary")}>
              Tambah soal
            </Link>
          }
        />
      ) : (
        <TableContainer>
          <Table>
            <Thead>
              <tr>
                <Th>No</Th>
                <Th>Teks Soal</Th>
                <Th>Format</Th>
                <Th>Kesulitan</Th>
                <Th>Kompetensi</Th>
                <Th></Th>
              </tr>
            </Thead>
            <tbody>
              {pkg.questions.map((q, idx) => (
                <Tr key={q.id}>
                  <Td className="w-10 text-center text-slate-400 text-xs font-medium">
                    {idx + 1}
                  </Td>
                  <Td className="max-w-sm">
                    <span className="line-clamp-2 text-sm text-slate-800 leading-relaxed">
                      {stripLatex(q.teks)}
                    </span>
                  </Td>
                  <Td>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                      FORMAT_COLOR[q.format] ?? "bg-slate-100 text-slate-600"
                    }`}>
                      {FORMAT_LABEL[q.format] ?? q.format}
                    </span>
                  </Td>
                  <Td>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                      KESULITAN_COLOR[q.tingkatKesulitan] ?? "bg-slate-100 text-slate-600"
                    }`}>
                      {q.tingkatKesulitan}
                    </span>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-mono font-medium text-indigo-700 ring-1 ring-indigo-200">
                      {q.kompetensi.kode}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`${basePath}/${packageId}/soal/${q.id}`}
                        className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                      >
                        {q._count.attemptAnswers > 0 ? "Lihat" : "Edit"}
                      </Link>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-sm font-medium text-rose-500 hover:text-rose-700 transition-colors"
                      >
                        Hapus
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}

      {pkg.ownerType === "pusat" && <PackageDistribution packageId={packageId} />}
    </div>
  );
}
