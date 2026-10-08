"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconLink } from "@/components/ui/empty-state-icons";
import { PilihWilayah } from "@/components/wilayah/pilih-wilayah";
import { provinsiDariKabupatenKota } from "@/lib/wilayah";
import { useResetPassword } from "@/components/admin/use-reset-password";

type DinasAdmin = {
  id: string;
  email: string;
  status: "aktif" | "nonaktif";
  nama: string | null;
  instansi: string | null;
  provinsi: string | null;
  kabupatenKota: string | null;
};

type FormState = { email: string; nama: string; instansi: string; provinsi: string; kabupatenKota: string };
const emptyForm: FormState = { email: "", nama: "", instansi: "", provinsi: "", kabupatenKota: "" };

type EditForm = { nama: string; instansi: string; provinsi: string; kabupatenKota: string };

/**
 * Admin pusat mengelola akun dinas pendidikan - akses read-only lintas
 * sekolah, dibatasi ke satu wilayah se-Indonesia per akun: satu kota/kabupaten
 * (Dinas Kota/Kabupaten) atau satu provinsi (Dinas Provinsi, semua kota/kabupaten
 * di dalamnya). Boleh lebih dari satu akun dinas (mis. beda instansi/penanggung
 * jawab), dan boleh untuk wilayah yang sama - tidak dibatasi satu akun per wilayah.
 */
export default function DinasPendidikanPage() {
  const resetPassword = useResetPassword();
  const [dinasAdmins, setDinasAdmins] = useState<DinasAdmin[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ nama: "", instansi: "", provinsi: "", kabupatenKota: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/dinas-admins");
      const data = await res.json().catch(() => null);
      if (!ignore) setDinasAdmins(data?.dinasAdmins ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin-pusat/dinas-admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Gagal membuat akun dinas pendidikan.");
      return;
    }

    setCreated({ email: form.email, tempPassword: data.tempPassword });
    setForm(emptyForm);
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  function openEdit(d: DinasAdmin) {
    setEditingId(d.id);
    setEditError(null);
    setEditForm({
      nama: d.nama ?? "",
      instansi: d.instansi ?? "",
      provinsi: d.provinsi ?? provinsiDariKabupatenKota(d.kabupatenKota) ?? "",
      kabupatenKota: d.kabupatenKota ?? "",
    });
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError(null);
    setEditSubmitting(true);

    const res = await fetch(`/api/admin-pusat/dinas-admins/${editingId}`, {
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
    setEditingId(null);
    setRefreshKey((k) => k + 1);
  }

  async function handleToggleStatus(d: DinasAdmin) {
    const nextStatus = d.status === "aktif" ? "nonaktif" : "aktif";
    const res = await fetch(`/api/admin-pusat/dinas-admins/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dinas Pendidikan"
        description="Kelola akun dinas pendidikan - akses baca saja untuk lihat kesiapan TKA sekolah-sekolah di wilayahnya. Setiap akun dibatasi ke satu provinsi (Dinas Provinsi) atau satu kota/kabupaten (Dinas Kota/Kabupaten) di Indonesia."
        action={
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Batal" : "Tambah akun dinas"}
          </Button>
        }
      />

      {created && (
        <Alert variant="success">
          Akun berhasil dibuat untuk <strong>{created.email}</strong>. Password sementara:{" "}
          <strong className="font-mono">{created.tempPassword}</strong> — sampaikan lewat jalur
          aman (bukan email), akun wajib ganti password saat login pertama. Password ini tidak
          akan ditampilkan lagi.
        </Alert>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          {error && <Alert variant="danger">{error}</Alert>}

          <div>
            <Label htmlFor="nama">Nama penanggung jawab</Label>
            <Input
              id="nama"
              required
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="instansi">Instansi</Label>
            <Input
              id="instansi"
              required
              placeholder="mis. Dinas Pendidikan Kota Malang"
              value={form.instansi}
              onChange={(e) => setForm({ ...form, instansi: e.target.value })}
            />
          </div>

          <div>
            <PilihWilayah
              idAwalan="dinasBaru"
              provinsi={form.provinsi}
              kabupatenKota={form.kabupatenKota}
              onChange={(w) => setForm({ ...form, provinsi: w.provinsi, kabupatenKota: w.kabupatenKota })}
              wajib
              wajibKabupatenKota={false}
              labelProvinsi="Provinsi wilayah cakupan"
              labelKabupatenKota="Kota/kabupaten (kosongkan untuk Dinas Provinsi)"
              kosongProvinsi="Pilih provinsi"
              kosongKabupatenKota="Semua kota/kabupaten di provinsi ini"
            />
            <p className="mt-1 text-xs text-slate-500">
              Akun ini hanya bisa melihat sekolah dan hasil siswa di wilayah yang dipilih: satu kota/kabupaten bila
              kota/kabupaten dipilih, atau SEMUA kota/kabupaten di provinsi itu bila dikosongkan (Dinas Provinsi).
              Sekolah perlu diberi provinsi dan kota/kabupaten yang sama lewat halaman Sekolah supaya ikut terlihat.
            </p>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? "Menyimpan..." : "Buat akun"}
          </Button>
        </form>
      )}

      {dinasAdmins === null && <TableSkeleton columns={5} />}

      {dinasAdmins?.length === 0 && (
        <EmptyState
          icon={<IconLink />}
          title="Belum ada akun dinas pendidikan"
          description="Tambah akun untuk memberi dinas pendidikan akses baca-saja ke kesiapan TKA sekolah-sekolah di wilayahnya."
          action={<Button onClick={() => setShowForm(true)}>Tambah akun dinas</Button>}
        />
      )}

      {dinasAdmins && dinasAdmins.length > 0 && (() => {
        const totalPages = Math.max(1, Math.ceil(dinasAdmins.length / pageSize));
        const pageRows = dinasAdmins.slice((page - 1) * pageSize, page * pageSize);
        return (
          <div className="flex flex-col gap-3">
            <TableContainer>
              <Table>
                <Thead>
                  <tr>
                    <Th>Instansi</Th>
                    <Th>Wilayah</Th>
                    <Th>Email</Th>
                    <Th>Status</Th>
                    <Th></Th>
                  </tr>
                </Thead>
                <tbody>
                  {pageRows.map((d) => (
                    <Fragment key={d.id}>
                      <Tr>
                        <Td className="font-medium text-slate-900">
                          {d.instansi ?? <span className="text-slate-400">Belum dilengkapi</span>}
                          {d.nama && <p className="text-xs font-normal text-slate-500">{d.nama}</p>}
                        </Td>
                        <Td>
                          {d.kabupatenKota || d.provinsi ? (
                            <div className="flex flex-col">
                              <span>{d.kabupatenKota ?? `Semua kota/kabupaten`}</span>
                              <span className="text-xs text-slate-500">
                                {d.kabupatenKota ? (d.provinsi ?? provinsiDariKabupatenKota(d.kabupatenKota)) : d.provinsi} ·{" "}
                                {d.kabupatenKota ? "Dinas Kota/Kabupaten" : "Dinas Provinsi"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-amber-600">Belum dipilih</span>
                          )}
                        </Td>
                        <Td className="text-slate-600">{d.email}</Td>
                        <Td>
                          <Badge variant={d.status === "aktif" ? "success" : "danger"}>
                            {d.status === "aktif" ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </Td>
                        <Td className="text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEdit(d)}
                              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() =>
                                resetPassword({
                                  endpoint: `/api/admin-pusat/dinas-admins/${d.id}/reset-password`,
                                  nama: d.email,
                                  pemilik: "Admin dinas",
                                })
                              }
                              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                            >
                              Reset password
                            </button>
                            <button
                              onClick={() => handleToggleStatus(d)}
                              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                            >
                              {d.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          </div>
                        </Td>
                      </Tr>
                      {editingId === d.id && (
                        <tr>
                          <td colSpan={5} className="border-b border-slate-100 bg-slate-50 px-4 py-4">
                            <form onSubmit={handleEditSubmit} className="flex flex-col gap-3">
                              {editError && <Alert variant="danger">{editError}</Alert>}
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                  <Label htmlFor={`edit-nama-${d.id}`}>Nama penanggung jawab</Label>
                                  <Input
                                    id={`edit-nama-${d.id}`}
                                    required
                                    value={editForm.nama}
                                    onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`edit-instansi-${d.id}`}>Instansi</Label>
                                  <Input
                                    id={`edit-instansi-${d.id}`}
                                    required
                                    value={editForm.instansi}
                                    onChange={(e) => setEditForm({ ...editForm, instansi: e.target.value })}
                                  />
                                </div>
                              </div>
                              <PilihWilayah
                                idAwalan={`edit-wilayah-${d.id}`}
                                provinsi={editForm.provinsi}
                                kabupatenKota={editForm.kabupatenKota}
                                onChange={(w) => setEditForm({ ...editForm, provinsi: w.provinsi, kabupatenKota: w.kabupatenKota })}
                                wajib
                                wajibKabupatenKota={false}
                                labelProvinsi="Provinsi wilayah cakupan"
                                labelKabupatenKota="Kota/kabupaten (kosongkan untuk Dinas Provinsi)"
                                kosongProvinsi="Pilih provinsi"
                                kosongKabupatenKota="Semua kota/kabupaten di provinsi ini"
                              />
                              <div className="flex gap-2">
                                <Button type="submit" disabled={editSubmitting}>
                                  {editSubmitting ? "Menyimpan..." : "Simpan perubahan"}
                                </Button>
                                <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                                  Batal
                                </Button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={dinasAdmins.length}
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
