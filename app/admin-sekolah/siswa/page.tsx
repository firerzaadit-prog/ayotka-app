"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";

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
const CLAIM_VARIANT: Record<string, "warning" | "success"> = {
  belum_klaim: "warning",
  sudah_klaim: "success",
};

const selectClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

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
      <PageHeader
        title="Kelola Siswa"
        description="Input satuan, import Excel/CSV, atau cetak kartu kode klaim."
        action={
          <>
            <label className={buttonClassName("secondary", "cursor-pointer")}>
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
                className={buttonClassName("secondary")}
              >
                Cetak kartu klaim
              </a>
            )}
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Batal" : "Tambah siswa"}</Button>
          </>
        }
      />

      {importResult && <Alert variant="info">{importResult}</Alert>}

      <div className="w-56">
        <Label htmlFor="classFilter">Rombel</Label>
        <select
          id="classFilter"
          className={selectClassName}
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
          className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          {error && <Alert variant="danger" className="w-full">{error}</Alert>}
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
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Nama</Th>
                <Th>NISN</Th>
                <Th>Kode Klaim</Th>
                <Th>Status</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <tbody>
              {students.map((s) => (
                <Tr key={s.id}>
                  <Td className="font-medium text-slate-900">{s.nama}</Td>
                  <Td className="font-mono text-xs">{s.nisn ?? "-"}</Td>
                  <Td className="font-mono text-xs">
                    {s.claimStatus === "belum_klaim" ? s.claimToken : "-"}
                  </Td>
                  <Td>
                    <Badge variant={CLAIM_VARIANT[s.claimStatus]}>{CLAIM_LABEL[s.claimStatus]}</Badge>
                  </Td>
                  <Td className="text-right">
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
                        className="text-sm font-medium text-rose-600 hover:underline"
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
