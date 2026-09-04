"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconLink } from "@/components/ui/empty-state-icons";

type DinasAdmin = { id: string; email: string; status: "aktif" | "nonaktif" };

type FormState = { email: string; nama: string; instansi: string };
const emptyForm: FormState = { email: "", nama: "", instansi: "" };

/** Admin pusat mengelola akun dinas pendidikan - akses read-only lintas sekolah untuk lihat kesiapan TKA. */
export default function DinasPendidikanPage() {
  const [dinasAdmins, setDinasAdmins] = useState<DinasAdmin[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dinas Pendidikan"
        description="Kelola akun dinas pendidikan - akses baca saja untuk lihat kesiapan TKA lintas sekolah."
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

      {dinasAdmins === null && <TableSkeleton columns={2} />}

      {dinasAdmins?.length === 0 && (
        <EmptyState
          icon={<IconLink />}
          title="Belum ada akun dinas pendidikan"
          description="Tambah akun untuk memberi dinas pendidikan akses baca-saja ke kesiapan TKA sekolah-sekolah."
          action={<Button onClick={() => setShowForm(true)}>Tambah akun dinas</Button>}
        />
      )}

      {dinasAdmins && dinasAdmins.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <tr>
                <Th>Email</Th>
                <Th>Status</Th>
              </tr>
            </Thead>
            <tbody>
              {dinasAdmins.map((d) => (
                <Tr key={d.id}>
                  <Td className="font-medium text-slate-900">{d.email}</Td>
                  <Td>
                    <Badge variant={d.status === "aktif" ? "success" : "danger"}>
                      {d.status === "aktif" ? "Aktif" : "Nonaktif"}
                    </Badge>
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
