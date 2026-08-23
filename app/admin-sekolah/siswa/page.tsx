"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

type ClassOption = { id: string; tingkat: number; namaRombel: string };
type StudentRow = {
  id: string;
  nama: string;
  nisn: string | null;
  claimToken: string | null;
  claimStatus: "belum_klaim" | "sudah_klaim";
  status: string;
  enrollments: { class: { tingkat: number; namaRombel: string } }[];
};

const CLAIM_LABEL: Record<string, string> = { belum_klaim: "Belum klaim", sudah_klaim: "Sudah klaim" };

export default function KelolaSiswaPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [nama, setNama] = useState("");
  const [nisn, setNisn] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-sekolah/kelas");
      const data = await res.json();
      if (!ignore) {
        setClasses(data.classes ?? []);
        setSelectedClassId((current) => current || (data.classes?.[0]?.id ?? ""));
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const qs = selectedClassId ? `?classId=${selectedClassId}` : "";
      const res = await fetch(`/api/admin-sekolah/siswa${qs}`);
      const data = await res.json();
      if (!ignore) setStudents(data.students ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [selectedClassId, refreshKey]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!selectedClassId) {
      setError("Pilih rombel dulu.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin-sekolah/siswa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama, nisn, tanggalLahir, classId: selectedClassId }),
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
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin-sekolah/siswa/import", { method: "POST", body: formData });
    const data = await res.json();
    setImporting(false);

    if (!res.ok && data.created === undefined) {
      setImportResult(data.error ?? "Gagal mengimpor file.");
      return;
    }
    const errorSummary =
      data.errors?.length > 0
        ? ` (${data.errors.length} baris gagal: ${data.errors
            .slice(0, 3)
            .map((er: { row: number; message: string }) => `baris ${er.row} - ${er.message}`)
            .join("; ")}${data.errors.length > 3 ? ", ..." : ""})`
        : "";
    setImportResult(`${data.created} siswa berhasil diimpor.${errorSummary}`);
    setRefreshKey((k) => k + 1);
  }

  async function handleResetKode(id: string) {
    if (!window.confirm("Reset kode klaim siswa ini?")) return;
    const res = await fetch(`/api/admin-sekolah/siswa/${id}/reset-kode-klaim`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      alert(data?.error ?? "Gagal reset kode klaim.");
    }
  }

  async function handleResetPassword(id: string) {
    if (!window.confirm("Reset password akun siswa ini? Password lama tidak akan berlaku lagi.")) return;
    const res = await fetch(`/api/admin-sekolah/siswa/${id}/reset-password`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      alert(`Password sementara: ${data.tempPassword}\n\nSampaikan ke siswa lewat jalur lain (bukan chat/email ini). Siswa wajib ganti password saat login berikutnya.`);
    } else {
      alert(data?.error ?? "Gagal reset password.");
    }
  }

  async function handleDelete(id: string, nama: string) {
    if (!window.confirm(`Hapus siswa "${nama}"? Riwayat nilai tetap tersimpan.`)) return;
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
          <h1 className="text-xl font-semibold text-slate-900">Kelola Siswa</h1>
          <p className="text-sm text-slate-500">Input satuan, import Excel/CSV, atau cetak kartu kode klaim.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {importing ? "Mengimpor..." : "Import Excel/CSV"}
            <input
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              disabled={importing}
              onChange={handleImport}
            />
          </label>
          {selectedClassId && (
            <a
              href={`/api/admin-sekolah/kelas/${selectedClassId}/kartu-klaim`}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cetak kartu klaim
            </a>
          )}
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Batal" : "Tambah siswa"}</Button>
        </div>
      </div>

      {importResult && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{importResult}</p>
      )}

      <div className="w-56">
        <Label htmlFor="classFilter">Rombel</Label>
        <select
          id="classFilter"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
        >
          {classes.length === 0 && <option value="">Belum ada rombel</option>}
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.tingkat}
              {c.namaRombel}
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          {error && (
            <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div className="flex-1">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" required value={nama} onChange={(e) => setNama(e.target.value)} />
          </div>
          <div className="w-40">
            <Label htmlFor="nisn">NISN (opsional)</Label>
            <Input id="nisn" value={nisn} onChange={(e) => setNisn(e.target.value)} />
          </div>
          <div className="w-40">
            <Label htmlFor="tanggalLahir">Tanggal lahir</Label>
            <Input
              id="tanggalLahir"
              type="date"
              value={tanggalLahir}
              onChange={(e) => setTanggalLahir(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      )}

      {students === null && <p className="text-sm text-slate-500">Memuat...</p>}
      {students?.length === 0 && (
        <EmptyState
          title="Belum ada siswa"
          description="Import dari Excel atau tambah satu per satu."
          action={<Button onClick={() => setShowForm(true)}>Tambah siswa</Button>}
        />
      )}

      {students && students.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-4 py-2 font-medium">NISN</th>
                <th className="px-4 py-2 font-medium">Kode Klaim</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-900">{s.nama}</td>
                  <td className="px-4 py-2 font-mono text-xs">{s.nisn ?? "-"}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {s.claimStatus === "belum_klaim" ? s.claimToken : "-"}
                  </td>
                  <td className="px-4 py-2">{CLAIM_LABEL[s.claimStatus]}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {s.claimStatus === "belum_klaim" && (
                        <button
                          onClick={() => handleResetKode(s.id)}
                          className="text-sm font-medium text-slate-600 hover:underline"
                        >
                          Reset kode
                        </button>
                      )}
                      {s.claimStatus === "sudah_klaim" && (
                        <button
                          onClick={() => handleResetPassword(s.id)}
                          className="text-sm font-medium text-slate-600 hover:underline"
                        >
                          Reset password
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(s.id, s.nama)}
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
    </div>
  );
}
