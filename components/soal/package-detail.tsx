"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type Question = {
  id: string;
  format: string;
  teks: string;
  tingkatKesulitan: string;
  kompetensi: { kode: string };
  _count: { attemptAnswers: number };
};

type PackageDetail = {
  id: string;
  nama: string;
  status: string;
  jumlahSoal: number;
  subjectId: string;
  blueprint: { id: string; nama: string; totalSoal: number } | null;
  questions: Question[];
};

const FORMAT_LABEL: Record<string, string> = {
  pg: "PG",
  pg_kompleks: "PG Kompleks",
  pg_kategori: "PG Kategori",
};

export function PackageDetail({
  packageId,
  basePath,
}: {
  packageId: string;
  basePath: string;
}) {
  const [pkg, setPkg] = useState<PackageDetail | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/packages/${packageId}`);
      const data = await res.json();
      if (!ignore) setPkg(data.package);
    })();
    return () => {
      ignore = true;
    };
  }, [packageId, refreshKey]);

  async function handlePublish() {
    setPublishError(null);
    setPublishing(true);
    const res = await fetch(`/api/packages/${packageId}/publish`, { method: "POST" });
    const data = await res.json();
    setPublishing(false);

    if (!res.ok) {
      setPublishError(data.error ?? "Gagal publish.");
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  if (!pkg) return <p className="text-sm text-slate-500">Memuat...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={basePath} className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke Bank Soal
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{pkg.nama}</h1>
            <p className="text-sm text-slate-500">
              Status: {pkg.status} · {pkg.questions.length}/{pkg.jumlahSoal} soal
              {pkg.blueprint && ` · Kisi-kisi: ${pkg.blueprint.nama}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`${basePath}/${packageId}/soal/baru`}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Tambah soal
            </Link>
            {pkg.status !== "published" && (
              <Button onClick={handlePublish} disabled={publishing}>
                {publishing ? "Memproses..." : "Publish"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {publishError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{publishError}</p>
      )}

      {pkg.questions.length === 0 ? (
        <EmptyState
          title="Belum ada soal"
          description="Tambah soal pertama untuk paket ini."
          action={
            <Link
              href={`${basePath}/${packageId}/soal/baru`}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Tambah soal
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Soal</th>
                <th className="px-4 py-2 font-medium">Format</th>
                <th className="px-4 py-2 font-medium">Kesulitan</th>
                <th className="px-4 py-2 font-medium">Kompetensi</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {pkg.questions.map((q) => (
                <tr key={q.id} className="border-b border-slate-100 last:border-0">
                  <td className="max-w-sm truncate px-4 py-2">{q.teks}</td>
                  <td className="px-4 py-2">{FORMAT_LABEL[q.format] ?? q.format}</td>
                  <td className="px-4 py-2">{q.tingkatKesulitan}</td>
                  <td className="px-4 py-2 font-mono text-xs">{q.kompetensi.kode}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`${basePath}/${packageId}/soal/${q.id}`}
                      className="text-sm font-medium text-slate-600 hover:text-slate-900"
                    >
                      {q._count.attemptAnswers > 0 ? "Lihat" : "Edit"}
                    </Link>
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
