"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type Subject = { id: string; nama: string; jenjang: "SD" | "SMP" };
type Materi = { id: string; nama: string; tingkat: number };
type SubMateri = { id: string; nama: string };
type Kompetensi = { id: string; kode: string; deskripsi: string };

type PreviewQuestion = {
  sourceId: string;
  code: string;
  nomorUrut: number | null;
  format: "pg" | "pg_kompleks" | "pg_kategori" | null;
  teks: string;
  elemen: string;
  subElemen: string | null;
  kompetensi: string | null;
  taxonomyMapped: boolean;
  taxonomyKompetensiLabel: string | null;
  levelKognitifSumber: string | null;
  levelBloom: "L1" | "L2" | "L3" | null;
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
const TINGKAT_BY_JENJANG: Record<"SD" | "SMP", number[]> = { SD: [4, 5, 6], SMP: [7, 8, 9] };

function taxonomyMatchKey(mapel: string, q: PreviewQuestion): string | null {
  return mapel === "Bahasa Indonesia" ? q.kompetensi : q.elemen;
}

export function ImportPreview({ paketId }: { paketId: string }) {
  const toast = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [tingkatList, setTingkatList] = useState<number[]>([]);
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

  const selectedSubject = matchingSubjects.find((s) => s.id === subjectId) ?? null;

  const unmappedLabels = useMemo(() => {
    if (!preview) return [];
    const seen = new Map<string, { elemen: string; subElemen: string | null; kompetensi: string | null }>();
    for (const q of preview.questions) {
      if (q.taxonomyMapped) continue;
      const key = taxonomyMatchKey(preview.sourcePaket.mapel, q);
      if (!key || seen.has(key)) continue;
      seen.set(key, { elemen: q.elemen, subElemen: q.subElemen, kompetensi: q.kompetensi });
    }
    return [...seen.values()];
  }, [preview]);

  const questionsNeedingLevel = useMemo(
    () => preview?.questions.filter((q) => !q.levelBloom) ?? [],
    [preview],
  );

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!preview) return <PageSkeleton />;

  const canConfirm =
    preview.readyToImport === false
      ? unmappedLabels.length === 0 && questionsNeedingLevel.every((q) => levelOverrides[q.sourceId])
      : true;

  async function handleConfirm() {
    if (!subjectId) {
      toast.error("Pilih subject tujuan dulu.");
      return;
    }
    if (tingkatList.length === 0) {
      toast.error("Pilih minimal satu tingkat kelas.");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/admin-pusat/soal-import/packages/${paketId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectId,
        tingkatList,
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
                <p className="mb-1 font-medium text-slate-700">{s.judul}</p>
                <p className="line-clamp-3 whitespace-pre-line text-slate-600">{s.konten}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {unmappedLabels.length > 0 && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-slate-900">
            Pemetaan taksonomi belum lengkap ({unmappedLabels.length})
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            Pilih Kompetensi ayotka-app untuk tiap label di bawah. Pilih subject tujuan dulu supaya daftar materi
            sesuai.
          </p>
          {!subjectId ? (
            <Alert variant="warning">Pilih subject tujuan di bagian &ldquo;Tujuan impor&rdquo; di bawah dulu.</Alert>
          ) : (
            <div className="flex flex-col gap-3">
              {unmappedLabels.map((label) => (
                <TaxonomyMappingRow
                  key={`${label.elemen}|${label.subElemen}|${label.kompetensi}`}
                  subjectId={subjectId}
                  mapel={preview.sourcePaket.mapel}
                  label={label}
                  onMapped={() => setRefreshKey((k) => k + 1)}
                />
              ))}
            </div>
          )}
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
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTingkatList([]);
              }}
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
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Tingkat kelas</label>
            <div className="flex gap-2">
              {(selectedSubject ? TINGKAT_BY_JENJANG[selectedSubject.jenjang] : []).map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={tingkatList.includes(t)}
                    onChange={(e) =>
                      setTingkatList((prev) => (e.target.checked ? [...prev, t] : prev.filter((v) => v !== t)))
                    }
                  />
                  {t}
                </label>
              ))}
            </div>
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
      className={`rounded-lg border p-3 text-sm ${isReady ? "border-slate-200" : "border-amber-300 bg-amber-50/50"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="mr-2 font-mono text-xs text-slate-500">
            #{question.nomorUrut ?? "?"} · {question.code}
          </span>
          {isReady ? <Badge variant="success">Siap</Badge> : <Badge variant="warning">Perlu perhatian</Badge>}
        </div>
        <span className="text-xs text-slate-400">{question.taxonomyKompetensiLabel ?? "belum dipetakan"}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-slate-700">{question.teks}</p>

      {question.blockedReasons.length > 0 && (
        <ul className="mt-1.5 list-inside list-disc text-xs text-amber-700">
          {question.blockedReasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      {needsLevel && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-amber-700">
            Level kognitif sumber &ldquo;{question.levelKognitifSumber ?? "(kosong)"}&rdquo; tidak dikenali - pilih
            manual:
          </span>
          <select
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
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

function TaxonomyMappingRow({
  subjectId,
  mapel,
  label,
  onMapped,
}: {
  subjectId: string;
  mapel: string;
  label: { elemen: string; subElemen: string | null; kompetensi: string | null };
  onMapped: () => void;
}) {
  const toast = useToast();
  const [materiList, setMateriList] = useState<Materi[]>([]);
  const [subMateriList, setSubMateriList] = useState<SubMateri[]>([]);
  const [kompetensiList, setKompetensiList] = useState<Kompetensi[]>([]);
  const [materiId, setMateriId] = useState("");
  const [subMateriId, setSubMateriId] = useState("");
  const [kompetensiId, setKompetensiId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-pusat/materi?subjectId=${subjectId}`);
      const data = await res.json();
      if (!ignore) setMateriList(data.materi ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [subjectId]);

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
    if (!kompetensiId) {
      toast.error("Pilih kompetensi dulu.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/admin-pusat/soal-import/taxonomy-mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...label, kompetensiId }),
    });
    const data = await res.json().catch(() => null);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Gagal menyimpan pemetaan.");
      return;
    }
    setSaved(true);
    onMapped();
  }

  const displayLabel = mapel === "Bahasa Indonesia" ? label.kompetensi : label.elemen;

  if (saved) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        <Badge variant="success">Tersimpan</Badge> &ldquo;{displayLabel}&rdquo; dipetakan.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3">
      <div className="mr-2 min-w-[10rem] text-sm font-medium text-slate-800">&ldquo;{displayLabel}&rdquo;</div>
      <div className="w-40">
        <select
          required
          className={selectClassName}
          value={materiId}
          onChange={(e) => setMateriId(e.target.value)}
        >
          <option value="">Materi</option>
          {materiList.map((m) => (
            <option key={m.id} value={m.id}>
              Tingkat {m.tingkat} · {m.nama}
            </option>
          ))}
        </select>
      </div>
      <div className="w-40">
        <select
          required
          disabled={!materiId}
          className={`${selectClassName} disabled:bg-slate-100`}
          value={subMateriId}
          onChange={(e) => setSubMateriId(e.target.value)}
        >
          <option value="">Sub materi</option>
          {subMateriList.map((sm) => (
            <option key={sm.id} value={sm.id}>
              {sm.nama}
            </option>
          ))}
        </select>
      </div>
      <div className="w-56">
        <select
          required
          disabled={!subMateriId}
          className={`${selectClassName} disabled:bg-slate-100`}
          value={kompetensiId}
          onChange={(e) => setKompetensiId(e.target.value)}
        >
          <option value="">Kompetensi</option>
          {kompetensiList.map((k) => (
            <option key={k.id} value={k.id}>
              {k.kode} · {k.deskripsi}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="secondary" disabled={submitting}>
        {submitting ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}
