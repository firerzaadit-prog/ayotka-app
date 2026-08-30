"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconUsers } from "@/components/ui/empty-state-icons";
import { useToast } from "@/components/ui/toast";
import { useDialog } from "@/components/ui/dialog";

type ClassRow = {
  id: string;
  tingkat: number;
  namaRombel: string;
  waliKelas: { id: string; email: string; username: string | null } | null;
  academicYear: { nama: string };
  _count: { studentEnrollments: number };
};
type WaliOption = { id: string; email: string; username: string | null };
type AcademicYearOption = { id: string; nama: string; isActive: boolean };

const selectClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

export default function KelolaKelasPage() {
  const toast = useToast();
  const { confirm } = useDialog();
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [waliOptions, setWaliOptions] = useState<WaliOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [tingkat, setTingkat] = useState("");
  const [namaRombel, setNamaRombel] = useState("");
  const [waliKelasId, setWaliKelasId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [naikKelasResult, setNaikKelasResult] = useState<string | null>(null);
  const [naikKelasBusy, setNaikKelasBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeYear = academicYears.find((y) => y.isActive);
  const isViewingActiveYear = !selectedYearId || selectedYearId === activeYear?.id;

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [yearRes, waliRes] = await Promise.all([
        fetch("/api/admin-pusat/academic-years"),
        fetch("/api/admin-sekolah/wali-kelas-options"),
      ]);
      const yearData = await yearRes.json();
      const waliData = await waliRes.json();
      if (!ignore) {
        const years: AcademicYearOption[] = yearData.academicYears ?? [];
        setAcademicYears(years);
        setWaliOptions(waliData.options ?? []);
        setSelectedYearId((current) => current || years.find((y) => y.isActive)?.id || "");
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!selectedYearId) {
        setClasses(null);
        return;
      }
      const res = await fetch(`/api/admin-sekolah/kelas?academicYearId=${selectedYearId}`);
      const data = await res.json();
      if (!ignore) setClasses(data.classes ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [selectedYearId, refreshKey]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin-sekolah/kelas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tingkat, namaRombel, waliKelasId }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal membuat rombel.");
      return;
    }

    setTingkat("");
    setNamaRombel("");
    setWaliKelasId("");
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(id: string, label: string) {
    const ok = await confirm({ title: `Hapus rombel "${label}"?`, danger: true });
    if (!ok) return;
    const res = await fetch(`/api/admin-sekolah/kelas/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      toast.error(data?.error ?? "Gagal menghapus rombel.");
    }
  }

  async function handleNaikKelas() {
    const ok = await confirm({
      title: "Naikkan semua siswa ke tingkat/rombel berikutnya di tahun ajaran aktif?",
      description: "Siswa di tingkat akhir akan ditandai lulus (nonaktif). Riwayat nilai tidak akan hilang.",
    });
    if (!ok) return;
    setNaikKelasBusy(true);
    setNaikKelasResult(null);
    const res = await fetch("/api/admin-sekolah/kelas/naik-kelas", { method: "POST" });
    const data = await res.json().catch(() => null);
    setNaikKelasBusy(false);

    if (!res.ok || !data) {
      setNaikKelasResult(data?.error ?? "Gagal menaikkan kelas. Coba muat ulang halaman lalu ulangi.");
      return;
    }
    setNaikKelasResult(
      `Berhasil: ${data.dipindah} siswa naik ke rombel berikutnya, ${data.diluluskan} siswa ditandai lulus.`,
    );
    setSelectedYearId(activeYear?.id ?? selectedYearId);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kelola Kelas/Rombel"
        description="Riwayat rombel & siswa tiap tahun ajaran tetap tersimpan - pilih tahun ajaran di bawah untuk melihatnya."
        action={
          <>
            <Button variant="secondary" onClick={handleNaikKelas} disabled={naikKelasBusy}>
              {naikKelasBusy ? "Memproses..." : "Naik Kelas massal"}
            </Button>
            <Button onClick={() => setShowForm((v) => !v)} disabled={!isViewingActiveYear}>
              {showForm ? "Batal" : "Tambah rombel"}
            </Button>
          </>
        }
      />

      <div className="w-64">
        <Label htmlFor="yearSelect">Tahun ajaran</Label>
        <select
          id="yearSelect"
          className={selectClassName}
          value={selectedYearId}
          onChange={(e) => setSelectedYearId(e.target.value)}
        >
          {academicYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.nama}
              {y.isActive ? " (aktif)" : ""}
            </option>
          ))}
        </select>
      </div>

      {!isViewingActiveYear && (
        <Alert variant="info">
          Ini arsip tahun ajaran lama, hanya bisa dilihat. Rombel baru cuma bisa ditambah di tahun
          ajaran yang aktif ({activeYear?.nama ?? "-"}).
        </Alert>
      )}

      {naikKelasResult && <Alert variant="info">{naikKelasResult}</Alert>}

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          {error && <Alert variant="danger" className="w-full">{error}</Alert>}
          <div className="w-24">
            <Label htmlFor="tingkat">Tingkat</Label>
            <Input
              id="tingkat"
              type="number"
              min={1}
              max={12}
              required
              value={tingkat}
              onChange={(e) => setTingkat(e.target.value)}
            />
          </div>
          <div className="w-32">
            <Label htmlFor="namaRombel">Nama rombel</Label>
            <Input
              id="namaRombel"
              required
              placeholder="mis. 7A"
              value={namaRombel}
              onChange={(e) => setNamaRombel(e.target.value)}
            />
          </div>
          <div className="w-56">
            <Label htmlFor="waliKelasId">Wali kelas (opsional)</Label>
            <select
              id="waliKelasId"
              className={selectClassName}
              value={waliKelasId}
              onChange={(e) => setWaliKelasId(e.target.value)}
            >
              <option value="">Belum ditentukan</option>
              {waliOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.username ?? w.email}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      )}

      {classes === null && <TableSkeleton columns={5} />}
      {classes?.length === 0 && isViewingActiveYear && (
        <EmptyState
          icon={<IconUsers />}
          title="Belum ada rombel di tahun ajaran ini"
          description='Kalau ini tahun ajaran baru dan siswa sudah ada di tahun sebelumnya, klik "Naik Kelas massal" di atas untuk memindahkan rombel & siswa secara otomatis. Atau tambah rombel baru dari awal.'
          action={<Button onClick={() => setShowForm(true)}>Tambah rombel</Button>}
        />
      )}
      {classes?.length === 0 && !isViewingActiveYear && (
        <EmptyState
          icon={<IconUsers />}
          title="Belum ada rombel di tahun ajaran ini"
          description="Sekolah belum punya rombel yang tercatat untuk tahun ajaran ini."
        />
      )}

      {classes && classes.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Tingkat</Th>
                <Th>Rombel</Th>
                <Th>Wali kelas</Th>
                <Th>Siswa</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <tbody>
              {classes.map((c) => (
                <Tr key={c.id}>
                  <Td>{c.tingkat}</Td>
                  <Td className="font-medium text-slate-900">{c.namaRombel}</Td>
                  <Td>{c.waliKelas ? (c.waliKelas.username ?? c.waliKelas.email) : "-"}</Td>
                  <Td>{c._count.studentEnrollments}</Td>
                  <Td className="text-right">
                    {isViewingActiveYear && (
                      <button
                        onClick={() => handleDelete(c.id, `${c.tingkat}${c.namaRombel}`)}
                        className="text-sm font-medium text-rose-600 hover:underline"
                      >
                        Hapus
                      </button>
                    )}
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
