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
import { IconDocument } from "@/components/ui/empty-state-icons";
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

type VisibilityRow = { targetType: "semua" | "sekolah" | "publik"; schoolId: string | null };
type VisibilityEntry = { targetType: "semua" | "sekolah" | "publik"; schoolId?: string };

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
  targetSiswa: "sekolah" | "mandiri" | "semua";
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
  // Distribusi: dua target independen yang bisa aktif bersamaan
  forSekolah: boolean;         // paket bisa dijadwalkan oleh admin sekolah
  sekolahMode: "semua" | "terpilih"; // jika forSekolah: semua sekolah atau sekolah terpilih
  visibilitySchoolIds: string[]; // daftar sekolah jika sekolahMode = "terpilih"
  forMandiri: boolean;         // paket bisa diakses siswa mandiri
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

function toEditForm(pkg: PackageDetail & { visibility?: VisibilityRow[] }): EditForm {
  const rows: VisibilityRow[] = pkg.visibility ?? [];
  const hasSekolah = rows.some((r) => r.targetType === "sekolah" || r.targetType === "semua");
  const hasPubik  = rows.some((r) => r.targetType === "publik");
  const isSemua   = rows.some((r) => r.targetType === "semua");
  return {
    nama: pkg.nama,
    subjectId: pkg.subjectId,
    jenjang: pkg.jenjang,
    tingkat: String(pkg.tingkat),
    durasiMenit: String(pkg.durasiMenit),
    jumlahSoal: String(pkg.jumlahSoal),
    modePembahasan: pkg.modePembahasan,
    bolehDipilihSiswa: pkg.bolehDipilihSiswa,
    forSekolah: hasSekolah,
    sekolahMode: isSemua ? "semua" : "terpilih",
    visibilitySchoolIds: rows.filter((v) => v.schoolId).map((v) => v.schoolId as string),
    forMandiri: hasPubik,
  };
}

function describeVisibility(rows: VisibilityRow[]): string {
  const labels: string[] = [];
  if (rows.some((r) => r.targetType === "semua")) labels.push("Semua Sekolah");
  else if (rows.some((r) => r.targetType === "sekolah")) labels.push("Sekolah Terpilih");
  if (rows.some((r) => r.targetType === "publik")) labels.push("Siswa Mandiri");
  return labels.length > 0 ? labels.join(" + ") : "Privat";
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
  const [pkg, setPkg] = useState<PackageDetail & { visibility?: VisibilityRow[] } | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allSchools, setAllSchools] = useState<{ id: string; nama: string }[]>([]);
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
      const [pkgRes, subjectRes, schoolRes] = await Promise.all([
        fetch(`/api/packages/${packageId}`),
        fetch("/api/admin-pusat/subjects"),
        fetch("/api/admin-pusat/schools"),
      ]);
      const data = await pkgRes.json();
      const subjectData = await subjectRes.json();
      const schoolData = await schoolRes.json().catch(() => ({ schools: [] }));
      if (!ignore) {
        setPkg(data.package);
        setSubjects(subjectData.subjects ?? []);
        setAllSchools(schoolData.schools ?? []);
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

    // Konversi flag forSekolah/forMandiri → format yang dimengerti API
    let visibilityMode: string;
    let visibilitySchoolIds: string[] | undefined;

    if (editForm.forSekolah && editForm.forMandiri) {
      // Keduanya aktif: kirim dua call terpisah atau gunakan mode "semua" + publik
      // Kita kirim sebagai visibilityEntries di body (format baru)
      visibilityMode = "custom";
    } else if (editForm.forSekolah) {
      visibilityMode = editForm.sekolahMode === "semua" ? "semua" : "sekolah";
      visibilitySchoolIds = editForm.sekolahMode === "terpilih" ? editForm.visibilitySchoolIds : undefined;
    } else if (editForm.forMandiri) {
      visibilityMode = "publik";
    } else {
      visibilityMode = "privat";
    }

    // Buat entries array untuk kasus custom (sekolah + mandiri sekaligus)
    let visibilityEntries: VisibilityEntry[] | undefined;
    if (visibilityMode === "custom") {
      if (editForm.sekolahMode === "semua") {
        visibilityEntries = [{ targetType: "semua" }, { targetType: "publik" }];
      } else {
        visibilityEntries = [
          ...editForm.visibilitySchoolIds.map((id) => ({ targetType: "sekolah" as const, schoolId: id })),
          { targetType: "publik" as const },
        ];
      }
    }

    const payload = {
      nama: editForm.nama,
      subjectId: editForm.subjectId,
      jenjang: editForm.jenjang,
      tingkat: editForm.tingkat,
      durasiMenit: editForm.durasiMenit,
      jumlahSoal: editForm.jumlahSoal,
      modePembahasan: editForm.modePembahasan,
      bolehDipilihSiswa: editForm.bolehDipilihSiswa,
      ...(visibilityEntries
        ? { visibilityEntries }
        : { visibilityMode, visibilitySchoolIds }),
    };

    const res = await fetch(`/api/packages/${packageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
          {" · Target: "}{describeVisibility(pkg.visibility ?? [])}
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
                  <Label htmlFor="editPkgSubject">Mata pelajaran</Label>
                  <select
                    id="editPkgSubject"
                    className={selectClassName}
                    value={editForm.subjectId}
                    onChange={(e) => {
                      const subj = subjects.find((s) => s.id === e.target.value);
                      if (subj) {
                        setEditForm({ ...editForm, subjectId: subj.id, jenjang: subj.jenjang });
                      }
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
                  <Label htmlFor="editPkgTingkat">Kelas</Label>
                  <select
                    id="editPkgTingkat"
                    className={selectClassName}
                    value={editForm.tingkat}
                    onChange={(e) => setEditForm({ ...editForm, tingkat: e.target.value })}
                  >
                    <option value="4">Kelas 4</option>
                    <option value="5">Kelas 5</option>
                    <option value="6">Kelas 6</option>
                    <option value="7">Kelas 7</option>
                    <option value="8">Kelas 8</option>
                    <option value="9">Kelas 9</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editPkgDurasi">Durasi (Menit)</Label>
                  <Input
                    id="editPkgDurasi"
                    type="number"
                    min="1"
                    required
                    value={editForm.durasiMenit}
                    onChange={(e) => setEditForm({ ...editForm, durasiMenit: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="editPkgJumlahSoal">Target Jumlah Soal</Label>
                  <Input
                    id="editPkgJumlahSoal"
                    type="number"
                    min="1"
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

              {pkg.ownerType === "pusat" && (
                <div className="pt-2 border-t border-slate-200 mt-2 flex flex-col gap-3">
                  <Label className="block">Distribusi / Target Pengguna</Label>
                  <p className="text-xs text-slate-500 -mt-2">Pilih satu atau keduanya. Paket bisa sekaligus dijadwalkan sekolah dan diakses siswa mandiri.</p>

                  {/* --- Target Sekolah --- */}
                  <div className="rounded-lg border border-slate-200 p-3 flex flex-col gap-2 bg-slate-50">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.forSekolah}
                        onChange={(e) => setEditForm({ ...editForm, forSekolah: e.target.checked })}
                        className="accent-indigo-600 h-4 w-4"
                      />
                      Tersedia untuk Jadwal Ujian Sekolah
                    </label>

                    {editForm.forSekolah && (
                      <div className="ml-6 flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                          <input
                            type="radio"
                            name="sekolahMode"
                            checked={editForm.sekolahMode === "semua"}
                            onChange={() => setEditForm({ ...editForm, sekolahMode: "semua" })}
                            className="accent-indigo-600"
                          />
                          Semua sekolah yang terdaftar
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                          <input
                            type="radio"
                            name="sekolahMode"
                            checked={editForm.sekolahMode === "terpilih"}
                            onChange={() => setEditForm({ ...editForm, sekolahMode: "terpilih" })}
                            className="accent-indigo-600"
                          />
                          Sekolah terpilih saja
                        </label>
                        {editForm.sekolahMode === "terpilih" && (
                          <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2 bg-white">
                            {allSchools.length === 0 && <p className="text-xs text-slate-400 p-1">Belum ada sekolah terdaftar.</p>}
                            {allSchools.map((school) => (
                              <label key={school.id} className="flex items-center gap-2 py-1 text-sm text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editForm.visibilitySchoolIds.includes(school.id)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setEditForm((prev) => {
                                      if (!prev) return prev;
                                      return {
                                        ...prev,
                                        visibilitySchoolIds: checked
                                          ? [...prev.visibilitySchoolIds, school.id]
                                          : prev.visibilitySchoolIds.filter((id) => id !== school.id),
                                      };
                                    });
                                  }}
                                  className="accent-indigo-600"
                                />
                                {school.nama}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* --- Target Mandiri --- */}
                  <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.forMandiri}
                        onChange={(e) => setEditForm({ ...editForm, forMandiri: e.target.checked })}
                        className="accent-indigo-600 h-4 w-4"
                      />
                      Tersedia untuk Try Out Mandiri (Siswa Non-Sekolah)
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-4">
                <Button type="button" variant="secondary" onClick={() => setShowEditForm(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={editSubmitting || (editForm.forSekolah && editForm.sekolahMode === "terpilih" && editForm.visibilitySchoolIds.length === 0)}>
                  {editSubmitting ? "Menyimpan..." : "Simpan perubahan"}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>

      {publishError && <Alert variant="danger">{publishError}</Alert>}

      {pkg.questions.length === 0 ? (
        <EmptyState
          icon={<IconDocument />}
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
    </div>
  );
}
