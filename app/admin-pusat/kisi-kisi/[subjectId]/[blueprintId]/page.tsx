"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { PageSkeleton } from "@/components/ui/skeleton";
import { IconDocument } from "@/components/ui/empty-state-icons";
import { useToast } from "@/components/ui/toast";
import { useDialog } from "@/components/ui/dialog";

type Materi = { id: string; nama: string; tingkat: number };
type SubMateri = { id: string; nama: string };
type Kompetensi = { id: string; kode: string; deskripsi: string };

type BlueprintItem = {
  id: string;
  tingkatKesulitan: string;
  formatSoal: string;
  jumlahSoal: number;
  kompetensi: { id: string; kode: string; deskripsi: string };
};

type BlueprintDetail = {
  id: string;
  nama: string;
  tingkat: number;
  totalSoal: number;
  subject: { id: string; nama: string };
  items: BlueprintItem[];
};

const LEVEL_OPTIONS = ["mudah", "sedang", "sulit"] as const;
const FORMAT_OPTIONS = ["pg", "pg_kompleks", "pg_kategori"] as const;
const FORMAT_LABEL: Record<string, string> = {
  pg: "PG",
  pg_kompleks: "PG Kompleks",
  pg_kategori: "PG Kategori",
};

export default function BlueprintDetailPage({
  params,
}: {
  params: Promise<{ subjectId: string; blueprintId: string }>;
}) {
  const { subjectId, blueprintId } = use(params);
  const toast = useToast();
  const { confirm } = useDialog();
  const [blueprint, setBlueprint] = useState<BlueprintDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/blueprints/${blueprintId}`);
      const data = await res.json();
      if (!ignore) setBlueprint(data.blueprint ?? null);
    })();
    return () => {
      ignore = true;
    };
  }, [blueprintId, refreshKey]);

  async function handleDeleteItem(itemId: string, label: string) {
    const ok = await confirm({ title: `Hapus target "${label}" dari kisi-kisi ini?`, danger: true });
    if (!ok) return;
    const res = await fetch(`/api/blueprints/${blueprintId}/items/${itemId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      toast.error(data?.error ?? "Gagal menghapus item.");
    }
  }

  if (!blueprint) return <PageSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin-pusat/kisi-kisi/${subjectId}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          &larr; Kembali ke daftar kisi-kisi
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{blueprint.nama}</h1>
        <p className="text-sm text-slate-500">
          {blueprint.subject.nama} · Tingkat {blueprint.tingkat} · Total {blueprint.totalSoal} soal
          ditarget
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <AddItemForm
        subjectId={subjectId}
        blueprintId={blueprintId}
        onAdded={() => setRefreshKey((k) => k + 1)}
        onError={setError}
      />

      {blueprint.items.length === 0 ? (
        <EmptyState
          icon={<IconDocument />}
          title="Belum ada target soal"
          description="Tambah target jumlah soal per kompetensi, tingkat kesulitan, dan format di atas."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Kompetensi</th>
                <th className="px-4 py-2 font-medium">Kesulitan</th>
                <th className="px-4 py-2 font-medium">Format</th>
                <th className="px-4 py-2 font-medium">Jumlah</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {blueprint.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <span className="mr-2 rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs">
                      {item.kompetensi.kode}
                    </span>
                    {item.kompetensi.deskripsi}
                  </td>
                  <td className="px-4 py-2">{item.tingkatKesulitan}</td>
                  <td className="px-4 py-2">{FORMAT_LABEL[item.formatSoal] ?? item.formatSoal}</td>
                  <td className="px-4 py-2">{item.jumlahSoal}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() =>
                        handleDeleteItem(item.id, `${item.kompetensi.kode} · ${item.tingkatKesulitan}`)
                      }
                      className="text-sm font-medium text-rose-600 hover:underline"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AddItemForm({
  subjectId,
  blueprintId,
  onAdded,
  onError,
}: {
  subjectId: string;
  blueprintId: string;
  onAdded: () => void;
  onError: (msg: string | null) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [materiList, setMateriList] = useState<Materi[]>([]);
  const [subMateriList, setSubMateriList] = useState<SubMateri[]>([]);
  const [kompetensiList, setKompetensiList] = useState<Kompetensi[]>([]);
  const [materiId, setMateriId] = useState("");
  const [subMateriId, setSubMateriId] = useState("");
  const [kompetensiId, setKompetensiId] = useState("");
  const [tingkatKesulitan, setTingkatKesulitan] =
    useState<(typeof LEVEL_OPTIONS)[number]>("mudah");
  const [formatSoal, setFormatSoal] = useState<(typeof FORMAT_OPTIONS)[number]>("pg");
  const [jumlahSoal, setJumlahSoal] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!showForm) return;
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-pusat/materi?subjectId=${subjectId}`);
      const data = await res.json();
      if (!ignore) setMateriList(data.materi ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [showForm, subjectId]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!materiId) {
        if (!ignore) {
          setSubMateriList([]);
          setSubMateriId("");
        }
        return;
      }
      const res = await fetch(`/api/admin-pusat/sub-materi?materiId=${materiId}`);
      const data = await res.json();
      if (!ignore) setSubMateriList(data.subMateri ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [materiId]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!subMateriId) {
        if (!ignore) {
          setKompetensiList([]);
          setKompetensiId("");
        }
        return;
      }
      const res = await fetch(`/api/admin-pusat/kompetensi?subMateriId=${subMateriId}`);
      const data = await res.json();
      if (!ignore) setKompetensiList(data.kompetensi ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [subMateriId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onError(null);
    if (!kompetensiId) {
      onError("Pilih kompetensi dulu.");
      return;
    }
    setSubmitting(true);

    const res = await fetch(`/api/blueprints/${blueprintId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kompetensiId, tingkatKesulitan, formatSoal, jumlahSoal }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      onError(data.error ?? "Gagal menambah target soal.");
      return;
    }

    setJumlahSoal("1");
    setShowForm(false);
    onAdded();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Batal" : "Tambah target soal"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-48">
            <label className="mb-1 block text-xs font-medium text-slate-700">Materi</label>
            <select
              required
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              value={materiId}
              onChange={(e) => setMateriId(e.target.value)}
            >
              <option value="">Pilih materi</option>
              {materiList.map((m) => (
                <option key={m.id} value={m.id}>
                  Tingkat {m.tingkat} · {m.nama}
                </option>
              ))}
            </select>
          </div>
          <div className="w-48">
            <label className="mb-1 block text-xs font-medium text-slate-700">Sub materi</label>
            <select
              required
              disabled={!materiId}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm disabled:bg-slate-100"
              value={subMateriId}
              onChange={(e) => setSubMateriId(e.target.value)}
            >
              <option value="">Pilih sub materi</option>
              {subMateriList.map((sm) => (
                <option key={sm.id} value={sm.id}>
                  {sm.nama}
                </option>
              ))}
            </select>
          </div>
          <div className="w-56">
            <label className="mb-1 block text-xs font-medium text-slate-700">Kompetensi</label>
            <select
              required
              disabled={!subMateriId}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm disabled:bg-slate-100"
              value={kompetensiId}
              onChange={(e) => setKompetensiId(e.target.value)}
            >
              <option value="">Pilih kompetensi</option>
              {kompetensiList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.kode} · {k.deskripsi}
                </option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs font-medium text-slate-700">Kesulitan</label>
            <select
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              value={tingkatKesulitan}
              onChange={(e) =>
                setTingkatKesulitan(e.target.value as (typeof LEVEL_OPTIONS)[number])
              }
            >
              {LEVEL_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="w-36">
            <label className="mb-1 block text-xs font-medium text-slate-700">Format soal</label>
            <select
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              value={formatSoal}
              onChange={(e) => setFormatSoal(e.target.value as (typeof FORMAT_OPTIONS)[number])}
            >
              {FORMAT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABEL[f]}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label className="mb-1 block text-xs font-medium text-slate-700">Jumlah</label>
            <Input
              type="number"
              min={1}
              required
              value={jumlahSoal}
              onChange={(e) => setJumlahSoal(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      )}
    </div>
  );
}
