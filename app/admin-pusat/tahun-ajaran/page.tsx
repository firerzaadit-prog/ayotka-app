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
import { IconCalendar } from "@/components/ui/empty-state-icons";
import { useToast } from "@/components/ui/toast";
import { useDialog } from "@/components/ui/dialog";

type AcademicYear = { id: string; nama: string; mulai: string; selesai: string; isActive: boolean };

export default function TahunAjaranPage() {
  const toast = useToast();
  const { confirm } = useDialog();
  const [years, setYears] = useState<AcademicYear[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [nama, setNama] = useState("");
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/academic-years");
      const data = await res.json();
      if (!ignore) setYears(data.academicYears ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin-pusat/academic-years", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama, mulai, selesai }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal membuat tahun ajaran.");
      return;
    }

    setNama("");
    setMulai("");
    setSelesai("");
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleAktivasi(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin-pusat/academic-years/${id}/aktivasi`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      toast.error(data?.error ?? "Gagal mengaktifkan.");
    }
  }

  async function handleDelete(id: string, nama: string) {
    const ok = await confirm({ title: `Hapus tahun ajaran "${nama}"?`, danger: true });
    if (!ok) return;
    setBusyId(id);
    const res = await fetch(`/api/admin-pusat/academic-years/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      toast.error(data?.error ?? "Gagal menghapus tahun ajaran.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tahun Ajaran"
        description={
          'Berlaku untuk semua sekolah. Tahun ajaran baru dibuat nonaktif dulu - klik Aktifkan saat siap dipakai sebagai tujuan tombol "Naik Kelas" di tiap sekolah.'
        }
        action={
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Batal" : "Buat tahun ajaran"}
          </Button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          {error && <Alert variant="danger" className="w-full">{error}</Alert>}
          <div className="flex-1">
            <Label htmlFor="nama">Nama</Label>
            <Input
              id="nama"
              required
              placeholder='mis. "2027/2028"'
              value={nama}
              onChange={(e) => setNama(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="mulai">Mulai</Label>
            <Input id="mulai" type="date" required value={mulai} onChange={(e) => setMulai(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="selesai">Selesai</Label>
            <Input
              id="selesai"
              type="date"
              required
              value={selesai}
              onChange={(e) => setSelesai(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      )}

      {years === null && <TableSkeleton columns={5} />}
      {years?.length === 0 && (
        <EmptyState
          icon={<IconCalendar />}
          title="Belum ada tahun ajaran"
          description="Buat tahun ajaran pertama supaya sekolah bisa membuat kelas/rombel."
          action={<Button onClick={() => setShowForm(true)}>Buat tahun ajaran</Button>}
        />
      )}

      {years && years.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <tr>
                <Th>Nama</Th>
                <Th>Mulai</Th>
                <Th>Selesai</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </Thead>
            <tbody>
              {years.map((y) => (
                <Tr key={y.id}>
                  <Td className="font-medium text-slate-900">{y.nama}</Td>
                  <Td>{new Date(y.mulai).toLocaleDateString("id-ID")}</Td>
                  <Td>{new Date(y.selesai).toLocaleDateString("id-ID")}</Td>
                  <Td>{y.isActive && <Badge variant="success">Aktif</Badge>}</Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      {!y.isActive && (
                        <button
                          onClick={() => handleAktivasi(y.id)}
                          disabled={busyId === y.id}
                          className="text-sm font-medium text-slate-600 hover:underline"
                        >
                          Aktifkan
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(y.id, y.nama)}
                        disabled={busyId === y.id}
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
