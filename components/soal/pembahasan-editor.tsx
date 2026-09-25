"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RichText } from "@/components/soal/rich-text";

type Soal = {
  id: string;
  nomor: number;
  format: "pg" | "pg_kompleks" | "pg_kategori";
  teks: string;
  pembahasan: string;
  kunci: string[];
};

type Data = {
  package: { id: string; nama: string; status: string };
  questions: Soal[];
};

const FORMAT_LABEL: Record<Soal["format"], string> = {
  pg: "PG",
  pg_kompleks: "PG Kompleks",
  pg_kategori: "PG Kategori",
};

const textareaClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

/**
 * Editor pembahasan massal untuk satu paket: semua soal dalam satu halaman,
 * isi pembahasan langsung di bawah tiap soal, simpan sekali. Hanya kolom
 * pembahasan yang berubah (PATCH /api/packages/[id]/pembahasan), jadi bisa
 * dipakai kapan saja - termasuk saat paket published dan soal sudah dijawab.
 */
export function PembahasanEditor({ packageId, basePath }: { packageId: string; basePath: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Nilai terakhir yang tersimpan di server (pembanding untuk mendeteksi perubahan).
  const [tersimpan, setTersimpan] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [hanyaKosong, setHanyaKosong] = useState(false);
  const [terbuka, setTerbuka] = useState<Record<string, boolean>>({});
  const [menyimpan, setMenyimpan] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: "sukses" | "gagal"; teks: string } | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/packages/${packageId}/pembahasan`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (ignore) return;
      if (!res.ok || !json) {
        setLoadError(json?.error ?? "Gagal memuat soal.");
        return;
      }
      const awal = Object.fromEntries((json.questions as Soal[]).map((q) => [q.id, q.pembahasan]));
      setData(json);
      setTersimpan(awal);
      setDraft(awal);
    })();
    return () => {
      ignore = true;
    };
  }, [packageId]);

  const berubah = useMemo(
    () => Object.keys(draft).filter((id) => (draft[id] ?? "").trim() !== (tersimpan[id] ?? "").trim()),
    [draft, tersimpan],
  );

  // Peringatan bawaan browser kalau halaman ditutup padahal ada yang belum disimpan.
  useEffect(() => {
    if (berubah.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [berubah.length]);

  async function simpan() {
    if (berubah.length === 0) return;
    setMenyimpan(true);
    setPesan(null);
    const res = await fetch(`/api/packages/${packageId}/pembahasan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: berubah.map((id) => ({ questionId: id, pembahasan: draft[id] ?? "" })) }),
    });
    const json = await res.json().catch(() => null);
    setMenyimpan(false);
    if (!res.ok) {
      setPesan({ tipe: "gagal", teks: json?.error ?? "Gagal menyimpan pembahasan." });
      return;
    }
    setTersimpan((prev) => ({ ...prev, ...Object.fromEntries(berubah.map((id) => [id, (draft[id] ?? "").trim()])) }));
    setDraft((prev) => ({ ...prev, ...Object.fromEntries(berubah.map((id) => [id, (prev[id] ?? "").trim()])) }));
    setPesan({ tipe: "sukses", teks: `Tersimpan: ${json?.diperbarui ?? berubah.length} pembahasan diperbarui.` });
  }

  if (loadError) return <Alert variant="danger">{loadError}</Alert>;
  if (!data) return <p className="text-sm text-slate-500">Memuat...</p>;

  const total = data.questions.length;
  const terisi = data.questions.filter((q) => (draft[q.id] ?? "").trim().length > 0).length;
  const tampil = hanyaKosong ? data.questions.filter((q) => (draft[q.id] ?? "").trim().length === 0) : data.questions;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`${basePath}/${packageId}`} className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke paket
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Pembahasan: {data.package.nama}</h1>
        <p className="text-sm text-slate-500">
          Isi pembahasan tiap soal di bawah lalu klik <strong>Simpan</strong>. Pembahasan tampil ke siswa
          langsung setelah mereka submit ujian, dan ikut tercetak di PDF rapor.
        </p>
      </div>

      <Alert variant="info">
        Halaman ini <strong>hanya mengubah pembahasan</strong> - teks soal, pilihan, kunci jawaban, dan nilai
        siswa tidak tersentuh, jadi aman dipakai kapan saja, termasuk saat paket sedang dipublish. Rumus
        matematika: apit dengan <code>$...$</code> (satu baris) atau <code>$$...$$</code> (blok).
      </Alert>

      <Card className="flex flex-wrap items-center gap-4">
        <div className="min-w-48 flex-1">
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium text-slate-900">
              {terisi} dari {total} soal sudah ada pembahasan
            </span>
            <span className="text-xs text-slate-500">{total - terisi} kosong</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${total === 0 ? 0 : (terisi / total) * 100}%` }}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={hanyaKosong}
            onChange={(e) => setHanyaKosong(e.target.checked)}
            className="accent-indigo-600"
          />
          Tampilkan hanya yang masih kosong
        </label>
      </Card>

      {pesan && <Alert variant={pesan.tipe === "sukses" ? "success" : "danger"}>{pesan.teks}</Alert>}

      {tampil.length === 0 && (
        <Alert variant="success">Semua soal di paket ini sudah punya pembahasan.</Alert>
      )}

      <div className="flex flex-col gap-4">
        {tampil.map((q) => {
          const nilai = draft[q.id] ?? "";
          const kosong = nilai.trim().length === 0;
          const dirty = berubah.includes(q.id);
          const buka = terbuka[q.id] ?? false;
          return (
            <Card key={q.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">
                  Soal {q.nomor} · {FORMAT_LABEL[q.format]}
                </span>
                <div className="flex items-center gap-2">
                  {dirty && <Badge variant="warning">Belum disimpan</Badge>}
                  <Badge variant={kosong ? "neutral" : "success"}>{kosong ? "Belum ada pembahasan" : "Sudah ada"}</Badge>
                </div>
              </div>

              <div className="text-sm text-slate-800">
                <div className={buka ? "" : "line-clamp-3"}>
                  <RichText text={q.teks} />
                </div>
                <button
                  type="button"
                  onClick={() => setTerbuka((prev) => ({ ...prev, [q.id]: !buka }))}
                  className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {buka ? "Ringkas soal" : "Tampilkan soal lengkap"}
                </button>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-900">
                <span className="font-semibold">Kunci jawaban: </span>
                {q.kunci.length === 0 ? (
                  "-"
                ) : (
                  <ul className="mt-0.5 list-disc pl-4">
                    {q.kunci.map((k, i) => (
                      <li key={i}>
                        <RichText text={k} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label htmlFor={`pembahasan-${q.id}`} className="mb-1 block text-xs font-medium text-slate-600">
                  Pembahasan
                </label>
                <textarea
                  id={`pembahasan-${q.id}`}
                  rows={5}
                  className={textareaClassName}
                  placeholder="Tulis langkah pengerjaan atau alasan jawaban yang benar..."
                  value={nilai}
                  onChange={(e) => {
                    setPesan(null);
                    setDraft((prev) => ({ ...prev, [q.id]: e.target.value }));
                  }}
                />
                {!kosong && (
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <span className="mr-1 text-xs font-medium text-slate-500">Pratinjau siswa:</span>
                    <RichText text={nilai} />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* sticky (bukan fixed) supaya tidak menutupi sidebar admin. */}
      <div className="sticky bottom-0 z-20 -mx-1 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-600">
            {berubah.length === 0 ? "Belum ada perubahan." : `${berubah.length} soal berubah, belum disimpan.`}
          </span>
          <Button onClick={simpan} disabled={menyimpan || berubah.length === 0}>
            {menyimpan ? "Menyimpan..." : berubah.length > 0 ? `Simpan (${berubah.length})` : "Simpan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
