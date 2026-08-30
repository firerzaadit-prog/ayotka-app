"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";
import { IconDocument } from "@/components/ui/empty-state-icons";
import { useToast } from "@/components/ui/toast";
import { useDialog } from "@/components/ui/dialog";

type Materi = {
  id: string;
  nama: string;
  urutan: number;
  tingkat: number;
  _count: { subMateri: number };
};
type SubMateri = { id: string; nama: string; urutan: number; _count: { kompetensi: number } };
type Kompetensi = { id: string; kode: string; deskripsi: string; levelKognitif: string };

const LEVEL_OPTIONS = [
  { value: "L1", label: "Level 1 – Pengetahuan & Pemahaman" },
  { value: "L2", label: "Level 2 – Aplikasi" },
  { value: "L3", label: "Level 3 – Penalaran" },
];

export default function TaxonomySubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = use(params);
  const toast = useToast();
  const { confirm } = useDialog();
  const [materi, setMateri] = useState<Materi[] | null>(null);
  const [tingkat, setTingkat] = useState("");
  const [namaMateri, setNamaMateri] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-pusat/materi?subjectId=${subjectId}`);
      const data = await res.json();
      if (!ignore) setMateri(data.materi ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [subjectId, refreshKey]);

  async function handleAddMateri(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin-pusat/materi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId, tingkat, nama: namaMateri, urutan: (materi?.length ?? 0) }),
    });
    if (res.ok) {
      setNamaMateri("");
      setTingkat("");
      setShowForm(false);
      setRefreshKey((k) => k + 1);
    }
  }

  async function handleDeleteMateri(id: string, nama: string) {
    const ok = await confirm({
      title: `Hapus materi "${nama}"?`,
      description: "Tindakan ini tidak bisa dibatalkan.",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin-pusat/materi/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      toast.error(data?.error ?? "Gagal menghapus materi.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin-pusat/taxonomy" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke daftar mapel
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Materi</h1>
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Batal" : "Tambah materi"}</Button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleAddMateri}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="w-24">
            <label className="mb-1 block text-sm font-medium text-slate-700">Tingkat</label>
            <Input
              type="number"
              min={1}
              max={12}
              required
              value={tingkat}
              onChange={(e) => setTingkat(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Nama materi</label>
            <Input required value={namaMateri} onChange={(e) => setNamaMateri(e.target.value)} />
          </div>
          <Button type="submit">Simpan</Button>
        </form>
      )}

      {materi === null && <ListSkeleton items={3} />}

      {materi?.length === 0 && (
        <EmptyState
          icon={<IconDocument />}
          title="Belum ada materi"
          description="Tambah materi pertama untuk mulai menyusun sub materi dan kompetensi."
        />
      )}

      <div className="flex flex-col gap-3">
        {materi?.map((m) => (
          <MateriItem key={m.id} materi={m} onDelete={handleDeleteMateri} />
        ))}
      </div>
    </div>
  );
}

function MateriItem({
  materi,
  onDelete,
}: {
  materi: Materi;
  onDelete: (id: string, nama: string) => void;
}) {
  const toast = useToast();
  const { confirm } = useDialog();
  const [open, setOpen] = useState(false);
  const [subMateri, setSubMateri] = useState<SubMateri[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [nama, setNama] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-pusat/sub-materi?materiId=${materi.id}`);
      const data = await res.json();
      if (!ignore) setSubMateri(data.subMateri ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [open, materi.id, refreshKey]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin-pusat/sub-materi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materiId: materi.id, nama, urutan: subMateri?.length ?? 0 }),
    });
    if (res.ok) {
      setNama("");
      setShowForm(false);
      setRefreshKey((k) => k + 1);
    }
  }

  async function handleDeleteSubMateri(id: string, namaSubMateri: string) {
    const ok = await confirm({
      title: `Hapus sub materi "${namaSubMateri}"?`,
      description: "Tindakan ini tidak bisa dibatalkan.",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin-pusat/sub-materi/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      toast.error(data?.error ?? "Gagal menghapus sub materi.");
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex w-full items-center justify-between px-4 py-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center justify-between text-left"
        >
          <span className="text-sm font-medium text-slate-900">
            Tingkat {materi.tingkat ?? "-"} · {materi.nama}
          </span>
          <span className="mr-3 text-xs text-slate-400">
            {open ? "▲" : "▼"} {subMateri?.length ?? materi._count.subMateri} sub materi
          </span>
        </button>
        <button
          onClick={() => onDelete(materi.id, materi.nama)}
          className="text-sm font-medium text-rose-600 hover:underline"
        >
          Hapus
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 flex justify-end">
            <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Batal" : "Tambah sub materi"}
            </Button>
          </div>

          {showForm && (
            <form onSubmit={handleAdd} className="mb-3 flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-slate-700">Nama sub materi</label>
                <Input required value={nama} onChange={(e) => setNama(e.target.value)} />
              </div>
              <Button type="submit">Simpan</Button>
            </form>
          )}

          {subMateri === null && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          )}
          {subMateri?.length === 0 && (
            <p className="text-sm text-slate-500">Belum ada sub materi.</p>
          )}

          <div className="flex flex-col gap-2">
            {subMateri?.map((sm) => (
              <SubMateriItem key={sm.id} subMateri={sm} onDelete={handleDeleteSubMateri} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubMateriItem({
  subMateri,
  onDelete,
}: {
  subMateri: SubMateri;
  onDelete: (id: string, nama: string) => void;
}) {
  const toast = useToast();
  const { confirm } = useDialog();
  const [open, setOpen] = useState(false);
  const [kompetensi, setKompetensi] = useState<Kompetensi[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [kode, setKode] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [level, setLevel] = useState("L1");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-pusat/kompetensi?subMateriId=${subMateri.id}`);
      const data = await res.json();
      if (!ignore) setKompetensi(data.kompetensi ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [open, subMateri.id, refreshKey]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin-pusat/kompetensi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subMateriId: subMateri.id, kode, deskripsi, levelKognitif: level }),
    });
    if (res.ok) {
      setKode("");
      setDeskripsi("");
      setShowForm(false);
      setRefreshKey((k) => k + 1);
    }
  }

  async function handleDeleteKompetensi(id: string, kodeKompetensi: string) {
    const ok = await confirm({
      title: `Hapus kompetensi "${kodeKompetensi}"?`,
      description: "Tindakan ini tidak bisa dibatalkan.",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin-pusat/kompetensi/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      toast.error(data?.error ?? "Gagal menghapus kompetensi.");
    }
  }

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50">
      <div className="flex w-full items-center justify-between px-3 py-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center justify-between text-left"
        >
          <span className="text-sm text-slate-800">{subMateri.nama}</span>
          <span className="mr-3 text-xs text-slate-400">
            {open ? "▲" : "▼"} {kompetensi?.length ?? subMateri._count.kompetensi} kompetensi
          </span>
        </button>
        <button
          onClick={() => onDelete(subMateri.id, subMateri.nama)}
          className="text-sm font-medium text-rose-600 hover:underline"
        >
          Hapus
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 p-3">
          <div className="mb-2 flex justify-end">
            <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Batal" : "Tambah kompetensi"}
            </Button>
          </div>

          {showForm && (
            <form onSubmit={handleAdd} className="mb-3 flex flex-wrap items-end gap-2">
              <div className="w-28">
                <label className="mb-1 block text-xs font-medium text-slate-700">Kode</label>
                <Input required value={kode} onChange={(e) => setKode(e.target.value)} />
              </div>
              <div className="w-24">
                <label className="mb-1 block text-xs font-medium text-slate-700">Level</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  {LEVEL_OPTIONS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-700">Deskripsi</label>
                <Input required value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
              </div>
              <Button type="submit">Simpan</Button>
            </form>
          )}

          {kompetensi === null && (
            <div className="flex flex-col gap-1">
              <Skeleton className="h-6" />
              <Skeleton className="h-6" />
            </div>
          )}
          {kompetensi?.length === 0 && <p className="text-xs text-slate-500">Belum ada kompetensi.</p>}

          <ul className="flex flex-col gap-1">
            {kompetensi?.map((k) => (
              <li key={k.id} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs">{k.kode}</span>
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                  {k.levelKognitif}
                </span>
                <span className="flex-1">{k.deskripsi}</span>
                <button
                  onClick={() => handleDeleteKompetensi(k.id, k.kode)}
                  className="text-xs font-medium text-rose-600 hover:underline"
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
