"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

type Materi = {
  id: string;
  nama: string;
  urutan: number;
  tingkat: number;
  _count: { subMateri: number };
};
type SubMateri = { id: string; nama: string; urutan: number; _count: { kompetensi: number } };
type Kompetensi = { id: string; kode: string; deskripsi: string; levelKognitif: string };

const LEVEL_OPTIONS = ["C1", "C2", "C3", "C4", "C5", "C6"];

export default function TaxonomySubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = use(params);
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

      {materi === null && <p className="text-sm text-slate-500">Memuat...</p>}

      {materi?.length === 0 && (
        <EmptyState
          title="Belum ada materi"
          description="Tambah materi pertama untuk mulai menyusun sub materi dan kompetensi."
        />
      )}

      <div className="flex flex-col gap-3">
        {materi?.map((m) => (
          <MateriItem key={m.id} materi={m} />
        ))}
      </div>
    </div>
  );
}

function MateriItem({ materi }: { materi: Materi }) {
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

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-slate-900">
          Tingkat {materi.tingkat ?? "-"} · {materi.nama}
        </span>
        <span className="text-xs text-slate-400">{open ? "▲" : "▼"} {materi._count.subMateri} sub materi</span>
      </button>

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

          {subMateri === null && <p className="text-sm text-slate-500">Memuat...</p>}
          {subMateri?.length === 0 && (
            <p className="text-sm text-slate-500">Belum ada sub materi.</p>
          )}

          <div className="flex flex-col gap-2">
            {subMateri?.map((sm) => (
              <SubMateriItem key={sm.id} subMateri={sm} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubMateriItem({ subMateri }: { subMateri: SubMateri }) {
  const [open, setOpen] = useState(false);
  const [kompetensi, setKompetensi] = useState<Kompetensi[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [kode, setKode] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [level, setLevel] = useState("C1");
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

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-sm text-slate-800">{subMateri.nama}</span>
        <span className="text-xs text-slate-400">
          {open ? "▲" : "▼"} {subMateri._count.kompetensi} kompetensi
        </span>
      </button>

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
                    <option key={l} value={l}>
                      {l}
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

          {kompetensi === null && <p className="text-xs text-slate-500">Memuat...</p>}
          {kompetensi?.length === 0 && <p className="text-xs text-slate-500">Belum ada kompetensi.</p>}

          <ul className="flex flex-col gap-1">
            {kompetensi?.map((k) => (
              <li key={k.id} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs">{k.kode}</span>
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                  {k.levelKognitif}
                </span>
                <span>{k.deskripsi}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
