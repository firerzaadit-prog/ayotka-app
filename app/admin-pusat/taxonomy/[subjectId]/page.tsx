"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";
import { IconDocument } from "@/components/ui/empty-state-icons";
import { useToast } from "@/components/ui/toast";
import { useDialog } from "@/components/ui/dialog";

type Elemen = {
  id: string;
  nama: string;
  urutan: number;
  resmi: boolean;
  _count: { kompetensi: number };
};
type Kompetensi = { id: string; subElemen: string; deskripsi: string; levelKognitif: string };

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
  const [elemen, setElemen] = useState<Elemen[] | null>(null);
  const [namaElemen, setNamaElemen] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-pusat/elemen?subjectId=${subjectId}`);
      const data = await res.json();
      if (!ignore) setElemen(data.elemen ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [subjectId, refreshKey]);

  async function handleAddElemen(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin-pusat/elemen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId, nama: namaElemen, urutan: (elemen?.length ?? 0) }),
    });
    if (res.ok) {
      setNamaElemen("");
      setShowForm(false);
      setRefreshKey((k) => k + 1);
    }
  }

  async function handleDeleteElemen(id: string, nama: string) {
    const ok = await confirm({
      title: `Hapus elemen "${nama}"?`,
      description: "Tindakan ini tidak bisa dibatalkan.",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin-pusat/elemen/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      toast.error(data?.error ?? "Gagal menghapus elemen.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin-pusat/taxonomy" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke daftar mapel
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Elemen</h1>
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Batal" : "Tambah elemen"}</Button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Elemen bertanda <Badge variant="success">Resmi</Badge> sudah dicocokkan dengan daftar resmi
          soal.ayotka.id. Elemen tanpa badge itu isian bebas admin - boleh dipakai, tapi belum
          diverifikasi terhadap referensi resmi.
        </p>
      </div>

      {showForm && (
        <form
          onSubmit={handleAddElemen}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Nama elemen</label>
            <Input required value={namaElemen} onChange={(e) => setNamaElemen(e.target.value)} />
          </div>
          <Button type="submit">Simpan</Button>
        </form>
      )}

      {elemen === null && <ListSkeleton items={3} />}

      {elemen?.length === 0 && (
        <EmptyState
          icon={<IconDocument />}
          title="Belum ada elemen"
          description="Tambah elemen pertama untuk mulai menyusun kompetensi."
        />
      )}

      <div className="flex flex-col gap-3">
        {elemen?.map((el) => (
          <ElemenItem key={el.id} elemen={el} onDelete={handleDeleteElemen} />
        ))}
      </div>
    </div>
  );
}

function ElemenItem({
  elemen,
  onDelete,
}: {
  elemen: Elemen;
  onDelete: (id: string, nama: string) => void;
}) {
  const toast = useToast();
  const { confirm } = useDialog();
  const [open, setOpen] = useState(false);
  const [kompetensi, setKompetensi] = useState<Kompetensi[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [subElemen, setSubElemen] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [level, setLevel] = useState("L1");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-pusat/kompetensi?elemenId=${elemen.id}`);
      const data = await res.json();
      if (!ignore) setKompetensi(data.kompetensi ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [open, elemen.id, refreshKey]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin-pusat/kompetensi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ elemenId: elemen.id, subElemen, deskripsi, levelKognitif: level }),
    });
    if (res.ok) {
      setSubElemen("");
      setDeskripsi("");
      setShowForm(false);
      setRefreshKey((k) => k + 1);
    }
  }

  async function handleDeleteKompetensi(id: string, label: string) {
    const ok = await confirm({
      title: `Hapus kompetensi "${label}"?`,
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
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex w-full items-center justify-between px-4 py-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center justify-between text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
            {elemen.nama}
            {elemen.resmi ? (
              <Badge variant="success">Resmi</Badge>
            ) : (
              <Badge variant="neutral">Belum diverifikasi</Badge>
            )}
          </span>
          <span className="mr-3 text-xs text-slate-400">
            {open ? "▲" : "▼"} {kompetensi?.length ?? elemen._count.kompetensi} kompetensi
          </span>
        </button>
        <button
          onClick={() => onDelete(elemen.id, elemen.nama)}
          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
        >
          Hapus
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 flex justify-end">
            <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Batal" : "Tambah kompetensi"}
            </Button>
          </div>

          {showForm && (
            <form onSubmit={handleAdd} className="mb-3 flex flex-wrap items-end gap-2">
              <div className="w-48">
                <label className="mb-1 block text-xs font-medium text-slate-700">Sub Elemen</label>
                <Input required value={subElemen} onChange={(e) => setSubElemen(e.target.value)} />
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
                <label className="mb-1 block text-xs font-medium text-slate-700">Kompetensi (Kisi-kisi)</label>
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
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">{k.subElemen}</span>
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                  {k.levelKognitif}
                </span>
                <span className="flex-1">{k.deskripsi}</span>
                <button
                  onClick={() => handleDeleteKompetensi(k.id, `${k.subElemen} - ${k.deskripsi}`)}
                  className="rounded-lg px-2 py-0.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
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
