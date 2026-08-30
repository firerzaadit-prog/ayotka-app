"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconDocument } from "@/components/ui/empty-state-icons";

type Subject = { id: string; nama: string; jenjang: "SD" | "SMP" };
type BlueprintListItem = {
  id: string;
  nama: string;
  tingkat: number;
  totalSoal: number;
  _count: { items: number };
};

export default function KisiKisiSubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = use(params);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [blueprints, setBlueprints] = useState<BlueprintListItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [nama, setNama] = useState("");
  const [tingkat, setTingkat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [subjectRes, blueprintRes] = await Promise.all([
        fetch("/api/admin-pusat/subjects"),
        fetch(`/api/blueprints?subjectId=${subjectId}`),
      ]);
      const subjectData = await subjectRes.json();
      const blueprintData = await blueprintRes.json();
      if (!ignore) {
        setSubject(
          (subjectData.subjects ?? []).find((s: Subject) => s.id === subjectId) ?? null,
        );
        setBlueprints(blueprintData.blueprints ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [subjectId, refreshKey]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!subject) return;
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/blueprints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId, jenjang: subject.jenjang, tingkat, nama }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal membuat kisi-kisi.");
      return;
    }

    setNama("");
    setTingkat("");
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin-pusat/kisi-kisi" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke daftar mapel
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">
            Kisi-kisi{subject ? ` · ${subject.nama}` : ""}
          </h1>
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Batal" : "Buat kisi-kisi"}</Button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          {error && (
            <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Nama kisi-kisi</label>
            <Input
              required
              placeholder='mis. "Kisi-kisi TKA Tingkat 8"'
              value={nama}
              onChange={(e) => setNama(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      )}

      {blueprints === null && <TableSkeleton columns={4} />}

      {blueprints?.length === 0 && (
        <EmptyState
          icon={<IconDocument />}
          title="Belum ada kisi-kisi"
          description="Buat kisi-kisi pertama, lalu tambahkan target soal per kompetensi."
          action={<Button onClick={() => setShowForm(true)}>Buat kisi-kisi</Button>}
        />
      )}

      {blueprints && blueprints.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-4 py-2 font-medium">Tingkat</th>
                <th className="px-4 py-2 font-medium">Total soal ditarget</th>
                <th className="px-4 py-2 font-medium">Item</th>
              </tr>
            </thead>
            <tbody>
              {blueprints.map((bp) => (
                <tr key={bp.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin-pusat/kisi-kisi/${subjectId}/${bp.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {bp.nama}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{bp.tingkat}</td>
                  <td className="px-4 py-2">{bp.totalSoal}</td>
                  <td className="px-4 py-2">{bp._count.items}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
