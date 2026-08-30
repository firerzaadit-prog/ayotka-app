"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { IconDocument } from "@/components/ui/empty-state-icons";

type Subject = { id: string; nama: string; jenjang: "SD" | "SMP" };
type BlueprintOption = { id: string; nama: string; jenjang: "SD" | "SMP"; tingkat: number };
type PackageListItem = {
  id: string;
  nama: string;
  jenjang: "SD" | "SMP";
  tingkat: number;
  status: string;
  jumlahSoal: number;
  subject: Subject;
  _count: { questions: number };
};

const emptyForm = {
  subjectId: "",
  nama: "",
  jenjang: "SD" as "SD" | "SMP",
  tingkat: "",
  durasiMenit: "",
  jumlahSoal: "",
  blueprintId: "",
  modePembahasan: "setelah_tutup" as "langsung" | "setelah_tutup",
  bolehDipilihSiswa: false,
};

const STATUS_BADGE_VARIANT: Record<string, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
};

const selectClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

export function PackageList({ basePath }: { basePath: string }) {
  const [packages, setPackages] = useState<PackageListItem[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [blueprints, setBlueprints] = useState<BlueprintOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [pkgRes, subjectRes] = await Promise.all([
        fetch("/api/packages"),
        fetch("/api/admin-pusat/subjects"),
      ]);
      const pkgData = await pkgRes.json();
      const subjectData = await subjectRes.json();
      if (!ignore) {
        setPackages(pkgData.packages ?? []);
        setSubjects(subjectData.subjects ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!form.subjectId) {
        if (!ignore) setBlueprints([]);
        return;
      }
      const res = await fetch(`/api/blueprints?subjectId=${form.subjectId}`);
      const data = await res.json();
      if (!ignore) setBlueprints(data.blueprints ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [form.subjectId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Gagal menyimpan paket.");
      return;
    }

    setForm(emptyForm);
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(packageId: string, nama: string) {
    if (!window.confirm(`Hapus paket "${nama}"? Soal & riwayatnya tetap aman, cuma paket ini yang diarsipkan.`)) {
      return;
    }
    const res = await fetch(`/api/packages/${packageId}`, { method: "DELETE" });
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bank Soal"
        action={<Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Batal" : "Buat paket"}</Button>}
      />

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <Alert variant="danger">{error}</Alert>}
            <div>
              <Label htmlFor="nama">Nama paket</Label>
              <Input
                id="nama"
                required
                placeholder='mis. "Paket A"'
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subjectId">Mapel</Label>
                <select
                  id="subjectId"
                  required
                  className={selectClassName}
                  value={form.subjectId}
                  onChange={(e) => {
                    const subject = subjects.find((s) => s.id === e.target.value);
                    setForm({
                      ...form,
                      subjectId: e.target.value,
                      jenjang: subject?.jenjang ?? form.jenjang,
                      blueprintId: "",
                    });
                  }}
                >
                  <option value="">Pilih mapel</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.jenjang})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="tingkat">Tingkat kelas</Label>
                <Input
                  id="tingkat"
                  type="number"
                  min={1}
                  max={12}
                  required
                  value={form.tingkat}
                  onChange={(e) => setForm({ ...form, tingkat: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="durasiMenit">Durasi (menit)</Label>
                <Input
                  id="durasiMenit"
                  type="number"
                  min={1}
                  required
                  value={form.durasiMenit}
                  onChange={(e) => setForm({ ...form, durasiMenit: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="jumlahSoal">Target jumlah soal</Label>
                <Input
                  id="jumlahSoal"
                  type="number"
                  min={1}
                  required
                  value={form.jumlahSoal}
                  onChange={(e) => setForm({ ...form, jumlahSoal: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="blueprintId">Kisi-kisi (opsional)</Label>
              <select
                id="blueprintId"
                className={selectClassName}
                value={form.blueprintId}
                onChange={(e) => setForm({ ...form, blueprintId: e.target.value })}
              >
                <option value="">Tanpa kisi-kisi</option>
                {blueprints
                  .filter((b) => b.jenjang === form.jenjang && String(b.tingkat) === form.tingkat)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nama}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label htmlFor="modePembahasan">Tampilkan pembahasan</Label>
              <select
                id="modePembahasan"
                className={selectClassName}
                value={form.modePembahasan}
                onChange={(e) =>
                  setForm({
                    ...form,
                    modePembahasan: e.target.value as "langsung" | "setelah_tutup",
                  })
                }
              >
                <option value="setelah_tutup">Setelah jendela ujian ditutup (aman dari bocor ke teman sekelas)</option>
                <option value="langsung">Langsung setelah siswa submit</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.bolehDipilihSiswa}
                onChange={(e) => setForm({ ...form, bolehDipilihSiswa: e.target.checked })}
                className="accent-indigo-600"
              />
              Boleh dipilih bebas siswa (Latihan Mandiri)
            </label>
            <p className="text-xs text-slate-500">
              Kalau aktif, siswa bisa memilih paket ini sendiri lewat menu Latihan Mandiri
              (di luar jadwal ujian) - selama paket sudah di-publish dan distribusinya
              (lihat halaman detail paket) mengizinkan siswa tersebut melihatnya.
            </p>
            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting ? "Menyimpan..." : "Simpan paket"}
            </Button>
          </form>
        </Card>
      )}

      {packages === null && <p className="text-sm text-slate-500">Memuat...</p>}

      {packages?.length === 0 && (
        <EmptyState
          icon={<IconDocument />}
          title="Belum ada paket soal"
          description="Buat paket pertama, lalu tambahkan soal ke dalamnya."
          action={<Button onClick={() => setShowForm(true)}>Buat paket</Button>}
        />
      )}

      {packages && packages.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <tr>
                <Th>Nama</Th>
                <Th>Mapel</Th>
                <Th>Tingkat</Th>
                <Th>Status</Th>
                <Th>Soal</Th>
                <Th></Th>
              </tr>
            </Thead>
            <tbody>
              {packages.map((pkg) => (
                <Tr key={pkg.id}>
                  <Td>
                    <Link href={`${basePath}/${pkg.id}`} className="font-medium text-slate-900 hover:underline">
                      {pkg.nama}
                    </Link>
                  </Td>
                  <Td>{pkg.subject.nama}</Td>
                  <Td>{pkg.tingkat}</Td>
                  <Td>
                    <Badge variant={STATUS_BADGE_VARIANT[pkg.status] ?? "neutral"}>{pkg.status}</Badge>
                  </Td>
                  <Td>
                    {pkg._count.questions}/{pkg.jumlahSoal}
                  </Td>
                  <Td className="text-right">
                    <button
                      onClick={() => handleDelete(pkg.id, pkg.nama)}
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
