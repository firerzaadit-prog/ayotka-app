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
type Elemen = { id: string; nama: string };
type Kompetensi = { id: string; subElemen: string; deskripsi: string };

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

      {question.gambarPreviewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- pratinjau memuat langsung dari soal.ayotka.id atau data-URI svg, belum jadi aset ayotka-app
        <img
          src={question.gambarPreviewUrl}
          alt={question.gambarAlt ?? ""}
          className="mt-2 max-h-32 rounded-md border border-slate-200 object-contain"
        />
      )}

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
  const [elemenList, setElemenList] = useState<Elemen[]>([]);
  const [kompetensiList, setKompetensiList] = useState<Kompetensi[]>([]);
  const [elemenId, setElemenId] = useState("");
  // "" = pilih dari daftar (elemenId), "__new__" = buat elemen baru dari namaElemenBaru.
  const [elemenMode, setElemenMode] = useState<"pilih" | "baru">("pilih");
  const [namaElemenBaru, setNamaElemenBaru] = useState(label.elemen);
  const [kompetensiId, setKompetensiId] = useState("");
  const [kompetensiMode, setKompetensiMode] = useState<"pilih" | "baru">("baru");
  const [subElemenBaru, setSubElemenBaru] = useState(label.subElemen ?? "");
  const [deskripsiBaru, setDeskripsiBaru] = useState(label.kompetensi ?? "");
  const [levelBaru, setLevelBaru] = useState<(typeof LEVEL_OPTIONS)[number]>("L1");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-pusat/elemen?subjectId=${subjectId}`);
      const data = await res.json();
      if (!ignore) setElemenList(data.elemen ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [subjectId]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!elemenId || elemenMode !== "pilih") {
        if (!ignore) setKompetensiList([]);
        return;
      }
      const res = await fetch(`/api/admin-pusat/kompetensi?elemenId=${elemenId}`);
      const data = await res.json();
      if (!ignore) setKompetensiList(data.kompetensi ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [elemenId, elemenMode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let resolvedKompetensiId = kompetensiId;

      let resolvedElemenId = elemenId;
      if (elemenMode === "baru") {
        if (!namaElemenBaru.trim()) {
          toast.error("Isi nama elemen dulu.");
          return;
        }
        const res = await fetch("/api/admin-pusat/elemen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjectId, nama: namaElemenBaru }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(data?.error ?? "Gagal membuat elemen baru.");
          return;
        }
        resolvedElemenId = data.elemen.id;
      }

      if (kompetensiMode === "baru") {
        if (!subElemenBaru.trim() || !deskripsiBaru.trim()) {
          toast.error("Isi Sub Elemen dan Kompetensi (Kisi-kisi) dulu.");
          return;
        }
        const res = await fetch("/api/admin-pusat/kompetensi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            elemenId: resolvedElemenId,
            subElemen: subElemenBaru,
            deskripsi: deskripsiBaru,
            levelKognitif: levelBaru,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(data?.error ?? "Gagal membuat kompetensi baru.");
          return;
        }
        resolvedKompetensiId = data.kompetensi.id;
      } else if (!resolvedKompetensiId) {
        toast.error("Pilih kompetensi dulu.");
        return;
      }

      const res = await fetch("/api/admin-pusat/soal-import/taxonomy-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...label, kompetensiId: resolvedKompetensiId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Gagal menyimpan pemetaan.");
        return;
      }
      setSaved(true);
      onMapped();
    } finally {
      setSubmitting(false);
    }
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <div className="text-sm font-medium text-slate-800">&ldquo;{displayLabel}&rdquo;</div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-48">
          <select
            className={selectClassName}
            value={elemenMode === "baru" ? "__new__" : elemenId}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                setElemenMode("baru");
                setElemenId("");
              } else {
                setElemenMode("pilih");
                setElemenId(e.target.value);
                setKompetensiId("");
              }
            }}
          >
            <option value="">Pilih elemen</option>
            {elemenList.map((el) => (
              <option key={el.id} value={el.id}>
                {el.nama}
              </option>
            ))}
            <option value="__new__">+ Buat elemen baru</option>
          </select>
          {elemenMode === "baru" && (
            <Input
              className="mt-1"
              placeholder="Nama elemen baru"
              value={namaElemenBaru}
              onChange={(e) => setNamaElemenBaru(e.target.value)}
            />
          )}
        </div>

        {elemenMode === "pilih" && elemenId && (
          <div className="w-56">
            <select
              className={selectClassName}
              value={kompetensiMode === "baru" ? "__new__" : kompetensiId}
              onChange={(e) => {
                if (e.target.value === "__new__") {
                  setKompetensiMode("baru");
                  setKompetensiId("");
                } else {
                  setKompetensiMode("pilih");
                  setKompetensiId(e.target.value);
                }
              }}
            >
              <option value="">Pilih kompetensi</option>
              {kompetensiList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.subElemen} · {k.deskripsi}
                </option>
              ))}
              <option value="__new__">+ Buat kompetensi baru</option>
            </select>
          </div>
        )}

        <Button type="submit" variant="secondary" disabled={submitting}>
          {submitting ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>

      {(kompetensiMode === "baru" || elemenMode === "baru") && (
        <div className="flex flex-wrap items-end gap-2 rounded-md bg-slate-50 p-2">
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-slate-700">Sub Elemen</label>
            <Input value={subElemenBaru} onChange={(e) => setSubElemenBaru(e.target.value)} />
          </div>
          <div className="w-24">
            <label className="mb-1 block text-xs font-medium text-slate-700">Level</label>
            <select
              className={selectClassName}
              value={levelBaru}
              onChange={(e) => setLevelBaru(e.target.value as (typeof LEVEL_OPTIONS)[number])}
            >
              {LEVEL_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-700">Kompetensi (Kisi-kisi)</label>
            <Input value={deskripsiBaru} onChange={(e) => setDeskripsiBaru(e.target.value)} />
          </div>
        </div>
      )}
    </form>
  );
}
