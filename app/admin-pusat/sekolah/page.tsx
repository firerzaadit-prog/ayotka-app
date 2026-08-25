"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";

type SchoolStatus = "pending_verifikasi" | "aktif" | "suspend";

type SchoolListItem = {
  id: string;
  nama: string;
  jenjang: "SD" | "SMP";
  kodeSekolah: string;
  status: SchoolStatus;
  kuotaSiswa: number;
  _count: { schoolUsers: number; students: number };
};

const STATUS_LABEL: Record<SchoolStatus, string> = {
  pending_verifikasi: "Menunggu verifikasi",
  aktif: "Aktif",
  suspend: "Suspend",
};
const STATUS_BADGE_VARIANT: Record<SchoolStatus, "warning" | "success" | "danger"> = {
  pending_verifikasi: "warning",
  aktif: "success",
  suspend: "danger",
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  async function handleDelete(schoolId: string, nama: string) {
    if (!window.confirm(`Hapus sekolah "${nama}" secara permanen? Tindakan ini tidak bisa dibatalkan.`)) {
      return;
    }
    setDeleteError(null);
    const res = await fetch(`/api/admin-pusat/schools/${schoolId}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      setDeleteError(data?.error ?? "Gagal menghapus sekolah.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sekolah"
        action={
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Batal" : "Tambah sekolah"}
          </Button>
        }
      />

      {createdCode && (
        <Alert variant="success">
          Sekolah berhasil dibuat. Kode Sekolah: <strong>{createdCode}</strong> — sampaikan
          kode ini ke sekolah untuk proses registrasi siswa.
        </Alert>
      )}

      {deleteError && <Alert variant="danger">{deleteError}</Alert>}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          {error && <Alert variant="danger">{error}</Alert>}

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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
        <TableContainer>
          <Table>
            <Thead>
              <tr>
                <Th>Nama</Th>
                <Th>Jenjang</Th>
                <Th>Kode Sekolah</Th>
                <Th>Status</Th>
                <Th>Admin</Th>
                <Th>Siswa</Th>
                <Th></Th>
              </tr>
            </Thead>
            <tbody>
              {schools.map((school) => (
                <Tr key={school.id}>
                  <Td>
                    <Link
                      href={`/admin-pusat/sekolah/${school.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {school.nama}
                    </Link>
                  </Td>
                  <Td>{school.jenjang}</Td>
                  <Td className="font-mono">{school.kodeSekolah}</Td>
                  <Td>
                    <Badge variant={STATUS_BADGE_VARIANT[school.status]}>
                      {STATUS_LABEL[school.status]}
                    </Badge>
                  </Td>
                  <Td>{school._count.schoolUsers}</Td>
                  <Td>
                    {school._count.students}/{school.kuotaSiswa}
                  </Td>
                  <Td className="text-right">
                    <button
                      onClick={() => handleDelete(school.id, school.nama)}
                      className="text-sm font-medium text-rose-600 hover:underline"
                    >
                      Hapus
                    </button>
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
