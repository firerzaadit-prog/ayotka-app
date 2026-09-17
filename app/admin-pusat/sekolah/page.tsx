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
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconSchool } from "@/components/ui/empty-state-icons";
import { useDialog } from "@/components/ui/dialog";

type SchoolStatus = "pending_verifikasi" | "aktif" | "suspend";

type SchoolListItem = {
  id: string;
  nama: string;
  jenjang: "SD" | "SMP";
  kodeSekolah: string;
  status: SchoolStatus;
  seatQuota?: number | null;
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
  seatQuota: string;
  validUntil: string;
  adminEmail: string;
  adminNama: string;
};

const emptyForm: SchoolFormState = {
  nama: "",
  npsn: "",
  jenjang: "SD",
  alamat: "",
  seatQuota: "",
  validUntil: "",
  adminEmail: "",
  adminNama: "",
};

export default function SekolahPage() {
  const { confirm } = useDialog();
  const [schools, setSchools] = useState<SchoolListItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SchoolFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{
    kodeSekolah: string;
    nama: string;
    seatQuota?: number | null;
    adminEmail?: string | null;
    tempPassword?: string | null;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

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

    const payload = {
      nama: form.nama,
      npsn: form.npsn || undefined,
      jenjang: form.jenjang,
      alamat: form.alamat || undefined,
      seatQuota: form.seatQuota ? Number(form.seatQuota) : undefined,
      validUntil: form.validUntil || undefined,
      adminEmail: form.adminEmail || undefined,
      adminNama: form.adminNama || undefined,
    };

    const res = await fetch("/api/admin-pusat/schools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Gagal menyimpan sekolah.");
      return;
    }

    setCreatedInfo({
      kodeSekolah: data.school.kodeSekolah,
      nama: data.school.nama,
      seatQuota: data.school.seatQuota,
      adminEmail: data.admin?.email ?? null,
      tempPassword: data.tempPassword ?? null,
    });
    setForm(emptyForm);
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(schoolId: string, nama: string) {
    const ok = await confirm({
      title: `Hapus sekolah "${nama}" secara permanen?`,
      description: "Tindakan ini tidak bisa dibatalkan.",
      danger: true,
    });
    if (!ok) return;
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

      {createdInfo && (
        <Alert variant="success" className="space-y-2">
          <div>
            <p className="font-semibold text-slate-900">
              Sekolah &quot;{createdInfo.nama}&quot; berhasil didaftarkan!
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Kode Sekolah: <strong className="font-mono text-indigo-700 font-bold">{createdInfo.kodeSekolah}</strong>
              {createdInfo.seatQuota != null ? ` • Kuota Kursi Siswa: ${createdInfo.seatQuota} siswa` : ""}
            </p>
          </div>
          {createdInfo.adminEmail && createdInfo.tempPassword ? (
            <div className="mt-2 rounded-lg bg-emerald-100/70 p-3 border border-emerald-300 text-xs text-slate-800 space-y-1.5">
              <p className="font-semibold text-emerald-900">
                Akun Admin Sekolah Telah Dibuatkan:
              </p>
              <div className="flex flex-col sm:flex-row sm:gap-6 gap-1 font-mono text-xs">
                <div>Email: <strong className="text-slate-900">{createdInfo.adminEmail}</strong></div>
                <div>Password Sementara: <strong className="bg-white px-2 py-0.5 rounded border border-emerald-300 text-emerald-900">{createdInfo.tempPassword}</strong></div>
              </div>
              <p className="text-slate-600 italic text-[11px] pt-1">
                *Sampaikan email dan password sementara ini kepada pihak Admin Sekolah. Admin sekolah akan diminta membuat password baru saat login pertama kali.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              Sampaikan kode sekolah ke pihak sekolah untuk proses registrasi, atau buka detail sekolah untuk menambahkan akun Admin Sekolah dan kuota kursi sewaktu-waktu.
            </p>
          )}
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

          <div className="border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Kuota Siswa (Kerjasama / Setara Paket Semester)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="seatQuota">Kuota Siswa (opsional)</Label>
                <Input
                  id="seatQuota"
                  type="number"
                  min="1"
                  placeholder="Contoh: 100"
                  value={form.seatQuota}
                  onChange={(e) => setForm({ ...form, seatQuota: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Jumlah batas siswa yang disepakati untuk dimasukkan oleh admin sekolah.
                </p>
              </div>
              <div>
                <Label htmlFor="validUntil">Masa Berlaku (opsional)</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Batas tanggal masa aktif siswa sekolah (misal: akhir semester).
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Akun Admin Sekolah (Opsional - Dibuatkan Password Sementara)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="adminEmail">Email Admin Sekolah</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  placeholder="admin@sekolah.sch.id"
                  value={form.adminEmail}
                  onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="adminNama">Nama Admin Sekolah</Label>
                <Input
                  id="adminNama"
                  placeholder="Contoh: Pak Budi (Operator)"
                  value={form.adminNama}
                  onChange={(e) => setForm({ ...form, adminNama: e.target.value })}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Jika diisi, sistem akan otomatis men-generate akun Admin Sekolah dengan password sementara untuk diberikan kepada sekolah.
            </p>
          </div>

          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? "Menyimpan..." : "Simpan sekolah"}
          </Button>
        </form>
      )}

      {schools === null && <TableSkeleton columns={7} />}

      {schools?.length === 0 && (
        <EmptyState
          icon={<IconSchool />}
          title="Belum ada sekolah"
          description="Tambah sekolah pertama untuk mulai mengelola akun admin sekolah dan siswanya."
          action={<Button onClick={() => setShowForm(true)}>Tambah sekolah</Button>}
        />
      )}

      {schools && schools.length > 0 && (() => {
        const totalPages = Math.max(1, Math.ceil(schools.length / pageSize));
        const pageRows = schools.slice((page - 1) * pageSize, page * pageSize);
        return (
          <div className="flex flex-col gap-3">
            <TableContainer>
              <Table>
                <Thead>
                  <tr>
                    <Th>Nama</Th>
                    <Th>Jenjang</Th>
                    <Th>Kode Sekolah</Th>
                    <Th>Status</Th>
                    <Th>Admin</Th>
                    <Th>Siswa / Kuota</Th>
                    <Th></Th>
                  </tr>
                </Thead>
                <tbody>
                  {pageRows.map((school) => (
                    <Tr key={school.id}>
                      <Td>
                        <Link
                          href={`/admin-pusat/sekolah/${school.id}`}
                          className="font-medium text-slate-900 transition-colors hover:text-indigo-600"
                        >
                          {school.nama}
                        </Link>
                      </Td>
                      <Td>{school.jenjang}</Td>
                      <Td className="font-mono text-xs font-medium text-slate-600">{school.kodeSekolah}</Td>
                      <Td>
                        <Badge variant={STATUS_BADGE_VARIANT[school.status]}>
                          {STATUS_LABEL[school.status]}
                        </Badge>
                      </Td>
                      <Td>{school._count.schoolUsers}</Td>
                      <Td>
                        <span className="font-medium text-slate-800">{school._count.students}</span>
                        <span className="text-slate-500"> / {school.seatQuota != null ? `${school.seatQuota}` : "∞"}</span>
                      </Td>
                      <Td className="text-right">
                        <button
                          onClick={() => handleDelete(school.id, school.nama)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                        >
                          Hapus
                        </button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={schools.length}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        );
      })()}
    </div>
  );
}
