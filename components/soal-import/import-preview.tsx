"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

import { RichText } from "@/components/soal/rich-text";

type Subject = { id: string; nama: string; jenjang: "SD" | "SMP" };

type PreviewOption = {
  label: string;
  teks: string;
  isCorrect: boolean;
};

type PreviewStatement = {
  no: number;
  teks: string;
  kategoriBenar: string;
};

type PreviewQuestion = {
  sourceId: string;
  code: string;
  nomorUrut: number | null;
  format: "pg" | "pg_kompleks" | "pg_kategori" | null;
  tingkatKesulitan: "mudah" | "sedang" | "sulit" | null;
  teks: string;
  pembahasan: string | null;
  opsi: PreviewOption[];
  kategoriRespons: string[];
  pernyataan: PreviewStatement[];
  elemen: string;
  subElemen: string | null;
  kompetensi: string | null;
  taxonomyMapped: boolean;
  taxonomyKompetensiLabel: string | null;
  levelKognitifSumber: string | null;
  levelBloom: "L1" | "L2" | "L3" | null;
  gambarTipe: "svg" | "url" | "perlu_ilustrasi" | "ilustrasi_kontekstual" | null;
  gambarPreviewUrl: string | null;
  gambarAlt: string | null;
  blockedReasons: string[];
};

type Preview = {
  sourcePaket: { id: string; code: string; nama: string; jenjang: string; mapel: string; jumlahSoal: number };
  stimulusList: Array<{ sourceId: string; tipe: string; judul: string; konten: string }>;
  questions: PreviewQuestion[];
  readyToImport: boolean;
  previousImports: Array<{ packageId: string; packageNama: string; importedAt: string }>;
};

const selectClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

const LEVEL_OPTIONS = ["L1", "L2", "L3"] as const;

export function ImportPreview({ paketId }: { paketId: string }) {
  const toast = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [durasiMenit, setDurasiMenit] = useState("60");
  const [kategori, setKategori] = useState<"mandiri" | "nasional">("nasional");
  const [levelOverrides, setLevelOverrides] = useState<Record<string, "L1" | "L2" | "L3">>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [previewRes, subjectRes] = await Promise.all([
        fetch(`/api/admin-pusat/soal-import/packages/${paketId}`),
        fetch("/api/admin-pusat/subjects"),
      ]);
      const previewData = await previewRes.json().catch(() => null);
      const subjectData = await subjectRes.json().catch(() => null);
      if (ignore) return;
      if (!previewRes.ok) {
        setError(previewData?.error ?? "Gagal memuat preview.");
        return;
      }
      setPreview(previewData.preview);
      setSubjects(subjectData?.subjects ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [paketId, refreshKey]);

  const matchingSubjects = useMemo(() => {
    if (!preview) return [];
    return subjects.filter((s) => s.nama === preview.sourcePaket.mapel);
  }, [subjects, preview]);

  const questionsNeedingLevel = useMemo(
    () => preview?.questions.filter((q) => !q.levelBloom) ?? [],
    [preview],
  );

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!preview) return <PageSkeleton />;

  // Taksonomi otomatis — admin cuma perlu isi Tujuan Impor (subject, durasi,
  // kategori) dan optional level kognitif override. Elemen/Kompetensi dibuat
  // otomatis dari label sumber saat eksekusi.
  const canConfirm =
    subjectId !== "" &&
    preview.questions.length > 0 &&
    preview.questions.every((q) => q.blockedReasons.length === 0) &&
    questionsNeedingLevel.every((q) => levelOverrides[q.sourceId]);

  async function handleConfirm() {
    if (!subjectId) {
      toast.error("Pilih subject tujuan dulu.");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/admin-pusat/soal-import/packages/${paketId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectId,
        durasiMenit: Number(durasiMenit),
        kategori,
        levelBloomOverrides: levelOverrides,
      }),
    });
    const data = await res.json().catch(() => null);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Gagal mengimpor paket.");
      return;
    }
    toast.success(`Berhasil diimpor - ${data.jumlahSoal} soal masuk ke Bank Soal sebagai draft.`);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin-pusat/bank-soal/impor" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke daftar paket
        </Link>
        <PageHeader
          title={preview.sourcePaket.nama}
          description={`${preview.sourcePaket.code} · ${preview.sourcePaket.jenjang} · ${preview.sourcePaket.mapel} · ${preview.sourcePaket.jumlahSoal} soal`}
        />
      </div>

      {preview.previousImports.length > 0 && (
        <Alert variant="info">
          Paket ini sudah pernah diimpor {preview.previousImports.length}x sebelumnya, terbaru:{" "}
          {preview.previousImports[0]!.packageNama} (
          {new Date(preview.previousImports[0]!.importedAt).toLocaleString("id-ID")}). Konfirmasi di bawah akan
          membuat paket baru, bukan menimpa yang lama.
        </Alert>
      )}

      {preview.stimulusList.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Bacaan bersama ({preview.stimulusList.length})
          </h2>
          <div className="flex flex-col gap-3">
            {preview.stimulusList.map((s) => (
              <div key={s.sourceId} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="mb-1.5 font-semibold text-slate-800">{s.judul}</p>
                <div className="text-slate-600 leading-relaxed">
                  <RichText text={s.konten} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Tujuan impor</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <label className="mb-1 block text-xs font-medium text-slate-700">Subject</label>
            <select
              className={selectClassName}
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">Pilih subject</option>
              {matchingSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama} ({s.jenjang})
                </option>
              ))}
            </select>
            {matchingSubjects.length === 0 && (
              <p className="mt-1 text-xs text-rose-600">
                Tidak ada subject &ldquo;{preview.sourcePaket.mapel}&rdquo; untuk jenjang ini di ayotka-app.
              </p>
            )}
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs font-medium text-slate-700">Durasi (menit)</label>
            <Input type="number" min={1} value={durasiMenit} onChange={(e) => setDurasiMenit(e.target.value)} />
          </div>
          <div className="w-48">
            <label className="mb-1 block text-xs font-medium text-slate-700">Kategori</label>
            <select
              className={selectClassName}
              value={kategori}
              onChange={(e) => setKategori(e.target.value as "mandiri" | "nasional")}
            >
              <option value="nasional">Try Out Nasional</option>
              <option value="mandiri">Try Out Mandiri</option>
            </select>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Taksonomi (Elemen, Sub Elemen, Kompetensi) otomatis diambil dari data soal.ayotka.id dan dibuat di
          ayotka-app jika belum ada &mdash; tidak perlu dipetakan manual.
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Soal ({preview.questions.length})</h2>
        <div className="flex flex-col gap-2">
          {preview.questions.map((q) => (
            <QuestionRow
              key={q.sourceId}
              question={q}
              levelOverride={levelOverrides[q.sourceId]}
              onLevelOverride={(level) => setLevelOverrides((prev) => ({ ...prev, [q.sourceId]: level }))}
            />
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleConfirm} disabled={!canConfirm || submitting}>
          {submitting ? "Mengimpor..." : "Konfirmasi impor"}
        </Button>
      </div>
    </div>
  );
}

const FORMAT_LABEL: Record<string, string> = {
  pg: "Pilihan Ganda",
  pg_kompleks: "PG Kompleks",
  pg_kategori: "PG Kategori",
};

const KESULITAN_CONFIG: Record<string, { label: string; className: string }> = {
  mudah: { label: "Mudah", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  sedang: { label: "Sedang", className: "bg-sky-50 text-sky-700 border-sky-200" },
  sulit: { label: "Sulit", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

function QuestionRow({
  question,
  levelOverride,
  onLevelOverride,
}: {
  question: PreviewQuestion;
  levelOverride: "L1" | "L2" | "L3" | undefined;
  onLevelOverride: (level: "L1" | "L2" | "L3") => void;
}) {
  const needsLevel = !question.levelBloom;
  const isReady = question.blockedReasons.length === 0 && (question.levelBloom !== null || Boolean(levelOverride));

  return (
    <div
      className={`rounded-lg border p-4 text-sm transition-colors ${
        isReady ? "border-slate-200 bg-white" : "border-amber-300 bg-amber-50/40"
      }`}
    >
      {/* Header baris: Nomor, status kesiapan, badge format, tingkat kesulitan, level Bloom, dan taksonomi */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs font-semibold text-slate-700">
            #{question.nomorUrut ?? "?"} · {question.code}
          </span>
          {isReady ? <Badge variant="success">Siap</Badge> : <Badge variant="warning">Perlu perhatian</Badge>}
          {question.format && (
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
              {FORMAT_LABEL[question.format] ?? question.format}
            </span>
          )}
          {question.tingkatKesulitan && KESULITAN_CONFIG[question.tingkatKesulitan] && (
            <span
              className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                KESULITAN_CONFIG[question.tingkatKesulitan]!.className
              }`}
            >
              {KESULITAN_CONFIG[question.tingkatKesulitan]!.label}
            </span>
          )}
          {question.levelBloom ? (
            <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-indigo-700">
              Level: {question.levelBloom}
            </span>
          ) : levelOverride ? (
            <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-indigo-700">
              Level: {levelOverride} (manual)
            </span>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-0.5 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{question.elemen}</span>
          {question.subElemen && <span className="text-[11px] text-slate-400">{question.subElemen}</span>}
        </div>
      </div>

      {/* Teks Soal */}
      <div className="mt-3 text-sm text-slate-800 leading-relaxed">
        <RichText text={question.teks} />
      </div>

      {/* Gambar jika ada */}
      {question.gambarPreviewUrl && (
        <div className="my-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau memuat langsung dari sumber */}
          <img
            src={question.gambarPreviewUrl}
            alt={question.gambarAlt ?? ""}
            className="max-h-60 rounded-md border border-slate-200 bg-white p-1 object-contain"
          />
        </div>
      )}

      {/* Pilihan Jawaban & Kunci Jawaban untuk PG dan PG Kompleks */}
      {question.opsi && question.opsi.length > 0 && (
        <div className="mt-3.5 flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-600">Pilihan &amp; Kunci Jawaban:</span>
          <ul className="flex flex-col gap-1.5">
            {question.opsi.map((o) => (
              <li
                key={o.label}
                className={`flex items-start gap-2.5 rounded-lg border p-2 text-xs transition-colors ${
                  o.isCorrect
                    ? "border-emerald-300 bg-emerald-50/70 font-medium text-emerald-950"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-semibold ${
                    o.isCorrect ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {o.label}
                </span>
                <div className="min-w-0 flex-1">
                  <RichText text={o.teks} />
                </div>
                {o.isCorrect && (
                  <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    ✓ Kunci Jawaban
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabel Pernyataan & Kunci untuk PG Kategori */}
      {question.pernyataan && question.pernyataan.length > 0 && (
        <div className="mt-3.5 flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-600">Pernyataan &amp; Kunci Respons:</span>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-700">
                <tr>
                  <th className="w-10 px-3 py-2 text-center">#</th>
                  <th className="px-3 py-2">Pernyataan</th>
                  <th className="px-3 py-2 text-right">Kunci Jawaban</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {question.pernyataan.map((p) => {
                  const isBenar =
                    p.kategoriBenar.toLowerCase().includes("benar") ||
                    p.kategoriBenar.toLowerCase().includes("tepat") ||
                    p.kategoriBenar.toLowerCase().includes("ya");
                  return (
                    <tr key={p.no} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-center font-mono text-slate-500">{p.no}</td>
                      <td className="px-3 py-2 text-slate-800">
                        <RichText text={p.teks} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${
                            isBenar ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {p.kategoriBenar}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pembahasan Soal */}
      {question.pembahasan && (
        <details className="group mt-3 rounded-lg border border-indigo-100 bg-indigo-50/30 p-2.5 text-xs">
          <summary className="flex cursor-pointer select-none items-center justify-between font-medium text-indigo-900 hover:text-indigo-950">
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="text-indigo-600">💡</span> Pembahasan
            </span>
            <span className="text-[11px] text-indigo-600 group-open:hidden">Klik untuk melihat &darr;</span>
            <span className="hidden text-[11px] text-indigo-600 group-open:inline">Tutup &uarr;</span>
          </summary>
          <div className="mt-2.5 border-t border-indigo-100/60 pt-2 leading-relaxed text-slate-700">
            <RichText text={question.pembahasan} />
          </div>
        </details>
      )}

      {/* Alasan Diblokir jika ada */}
      {question.blockedReasons.length > 0 && (
        <ul className="mt-2.5 list-inside list-disc rounded-md bg-amber-100/60 p-2 text-xs text-amber-800">
          {question.blockedReasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      {/* Pilihan Level Kognitif Manual jika belum ada */}
      {needsLevel && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
          <span className="font-medium text-amber-800">
            Level kognitif sumber &ldquo;{question.levelKognitifSumber ?? "(kosong)"}&rdquo; tidak dikenali &mdash; pilih
            manual:
          </span>
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
            value={levelOverride ?? ""}
            onChange={(e) => onLevelOverride(e.target.value as "L1" | "L2" | "L3")}
          >
            <option value="">Pilih level</option>
            {LEVEL_OPTIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
