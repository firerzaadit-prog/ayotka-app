"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ImageUpload } from "@/components/soal/image-upload";
import { InlineImageUpload } from "@/components/soal/inline-image-upload";
import { RichText } from "@/components/soal/rich-text";

function insertAtCursor(inputId: string, textToInsert: string, value: string, setter: (val: string) => void) {
  const el = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) {
    setter(value + " " + textToInsert);
    return;
  }
  const start = el.selectionStart;
  const end = el.selectionEnd;
  if (start === null || end === null) {
    setter(value + " " + textToInsert);
    return;
  }
  const newValue = value.substring(0, start) + textToInsert + value.substring(end);
  setter(newValue);
  setTimeout(() => {
    el.selectionStart = el.selectionEnd = start + textToInsert.length;
    el.focus();
  }, 0);
}

function wrapAtCursor(inputId: string, openTag: string, closeTag: string, value: string, setter: (val: string) => void) {
  const el = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) {
    setter(value + " " + openTag + closeTag);
    return;
  }
  const start = el.selectionStart;
  const end = el.selectionEnd;
  if (start === null || end === null) {
    setter(value + " " + openTag + closeTag);
    return;
  }
  const selectedText = value.substring(start, end);
  const newValue = value.substring(0, start) + openTag + selectedText + closeTag + value.substring(end);
  setter(newValue);
  setTimeout(() => {
    el.selectionStart = start + openTag.length;
    el.selectionEnd = start + openTag.length + selectedText.length;
    el.focus();
  }, 0);
}

function FormatToolbar({ inputId, value, setter }: { inputId: string; value: string; setter: (val: string) => void }) {
  const btn = "rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <InlineImageUpload onUpload={(url) => insertAtCursor(inputId, `\n![Gambar](${url})\n`, value, setter)} />
      <div className="h-4 w-px bg-slate-300"></div>
      <button type="button" className={btn} onClick={() => wrapAtCursor(inputId, "**", "**", value, setter)} title="Cetak Tebal"><strong className="font-bold">B</strong></button>
      <button type="button" className={btn} onClick={() => wrapAtCursor(inputId, "*", "*", value, setter)} title="Cetak Miring"><em className="italic font-serif">I</em></button>
      <div className="h-4 w-px bg-slate-300"></div>
      <button type="button" className={btn} onClick={() => wrapAtCursor(inputId, "[left]", "[/left]", value, setter)}>Rata Kiri</button>
      <button type="button" className={btn} onClick={() => wrapAtCursor(inputId, "[center]", "[/center]", value, setter)}>Rata Tengah</button>
      <button type="button" className={btn} onClick={() => wrapAtCursor(inputId, "[right]", "[/right]", value, setter)}>Rata Kanan</button>
      <button type="button" className={btn} onClick={() => wrapAtCursor(inputId, "[justify]", "[/justify]", value, setter)}>Justify</button>
    </div>
  );
}

type Format = "pg" | "pg_kompleks" | "pg_kategori";
type Option = { label: string; teks: string; media: string | null; isCorrect: boolean; urutan: number };
type Statement = { teks: string; media: string | null; correctCategory: "Benar" | "Salah"; urutan: number };
type Materi = { id: string; nama: string };
type SubMateri = { id: string; nama: string };
type Kompetensi = { id: string; kode: string; deskripsi: string };

const LEVEL_OPTIONS = [
  { value: "L1", label: "Level 1 – Pengetahuan & Pemahaman" },
  { value: "L2", label: "Level 2 – Aplikasi" },
  { value: "L3", label: "Level 3 – Penalaran" },
];
const KESULITAN_OPTIONS = ["mudah", "sedang", "sulit"] as const;
const OPTION_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const selectClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

function emptyOptions(count: number): Option[] {
  return Array.from({ length: count }, (_, i) => ({
    label: OPTION_LABELS[i]!,
    teks: "",
    media: null,
    isCorrect: false,
    urutan: i,
  }));
}

export type QuestionFormInitial = {
  id: string;
  format: Format;
  teks: string;
  media: string | null;
  bobot: number;
  tingkatKesulitan: (typeof KESULITAN_OPTIONS)[number];
  materiId: string | null;
  subMateriId: string | null;
  kompetensiId: string;
  levelBloom: string;
  pembahasan: string | null;
  options: Option[];
  statements: (Statement & { correctCategory: "Benar" | "Salah" })[];
};

export function QuestionForm({
  packageId,
  subjectId,
  basePath,
  initial,
  locked,
}: {
  packageId: string;
  subjectId: string;
  basePath: string;
  initial?: QuestionFormInitial;
  locked?: boolean;
}) {
  const router = useRouter();
  const [format, setFormat] = useState<Format>(initial?.format ?? "pg");
  const [teks, setTeks] = useState(initial?.teks ?? "");
  const [media, setMedia] = useState<string | null>(initial?.media ?? null);
  const [bobot, setBobot] = useState(String(initial?.bobot ?? 1));
  const [tingkatKesulitan, setTingkatKesulitan] = useState<(typeof KESULITAN_OPTIONS)[number]>(
    initial?.tingkatKesulitan ?? "sedang",
  );
  const [levelBloom, setLevelBloom] = useState(initial?.levelBloom ?? "L1");
  const [pembahasan, setPembahasan] = useState(initial?.pembahasan ?? "");

  const [materiId, setMateriId] = useState(initial?.materiId ?? "");
  const [subMateriId, setSubMateriId] = useState(initial?.subMateriId ?? "");
  const [kompetensiId, setKompetensiId] = useState(initial?.kompetensiId ?? "");
  const [materiList, setMateriList] = useState<Materi[]>([]);
  const [subMateriList, setSubMateriList] = useState<SubMateri[]>([]);
  const [kompetensiList, setKompetensiList] = useState<Kompetensi[]>([]);

  const [options, setOptions] = useState<Option[]>(
    initial?.options ?? emptyOptions(format === "pg" ? 4 : 2),
  );
  const [statements, setStatements] = useState<Statement[]>(
    initial?.statements ?? [{ teks: "", media: null, correctCategory: "Benar", urutan: 0 }],
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        if (!ignore) setSubMateriList([]);
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
        if (!ignore) setKompetensiList([]);
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

  function updateOption(index: number, patch: Partial<Option>) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function toggleCorrect(index: number) {
    if (format === "pg") {
      setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrect: i === index })));
    } else {
      setOptions((prev) =>
        prev.map((o, i) => (i === index ? { ...o, isCorrect: !o.isCorrect } : o)),
      );
    }
  }

  function addOption() {
    if (options.length >= 8) return;
    setOptions((prev) => [
      ...prev,
      { label: OPTION_LABELS[prev.length]!, teks: "", media: null, isCorrect: false, urutan: prev.length },
    ]);
  }

  function removeOption(index: number) {
    if (options.length <= (format === "pg" ? 4 : 2)) return;
    setOptions((prev) => prev.filter((_, i) => i !== index).map((o, i) => ({ ...o, urutan: i })));
  }

  function updateStatement(index: number, patch: Partial<Statement>) {
    setStatements((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addStatement() {
    if (statements.length >= 3) return;
    setStatements((prev) => [
      ...prev,
      { teks: "", media: null, correctCategory: "Benar", urutan: prev.length },
    ]);
  }

  function removeStatement(index: number) {
    if (statements.length <= 1) return;
    setStatements((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, urutan: i })));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: Record<string, unknown> = {
      format,
      teks,
      media,
      bobot,
      tingkatKesulitan,
      materiId,
      subMateriId,
      kompetensiId,
      levelBloom,
      pembahasan,
    };
    if (format === "pg" || format === "pg_kompleks") {
      payload.options = options;
    } else {
      payload.statements = statements;
    }

    setSubmitting(true);
    const url = initial ? `/api/questions/${initial.id}` : `/api/packages/${packageId}/questions`;
    const method = initial ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal menyimpan soal.");
      return;
    }

    router.push(`${basePath}/${packageId}`);
    router.refresh();
  }

  if (locked) {
    return (
      <Alert variant="warning">
        Soal ini sudah pernah dijawab siswa dan tidak bisa diedit lagi. Buat soal baru kalau perlu
        perbaikan.
      </Alert>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && <Alert variant="danger">{error}</Alert>}

        {!initial && (
          <div>
            <Label htmlFor="format">Format soal</Label>
            <select
              id="format"
              className={`max-w-xs ${selectClassName}`}
              value={format}
              onChange={(e) => {
                const next = e.target.value as Format;
                setFormat(next);
                setOptions(emptyOptions(next === "pg" ? 4 : 2));
              }}
            >
              <option value="pg">Pilihan Ganda</option>
              <option value="pg_kompleks">PG Kompleks (jawaban ganda)</option>
              <option value="pg_kategori">PG Kategori (Benar/Salah)</option>
            </select>
          </div>
        )}

        <div>
          <Label htmlFor="teks">Teks soal</Label>
          <p className="mb-2 text-xs text-slate-500">
            Rumus matematika: apit dengan $...$ untuk inline atau $$...$$ untuk blok. <br />
            Format Teks: Gunakan toolbar di bawah untuk menyisipkan gambar, cetak tebal/miring, atau mengatur perataan teks (kiri/tengah/kanan). Blok teks yang ingin diatur perataannya sebelum menekan tombol.
          </p>
          <textarea
            id="teks"
            required
            rows={4}
            className={selectClassName}
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
          />
          <FormatToolbar inputId="teks" value={teks} setter={setTeks} />
          {teks && (
            <div className="mt-2 rounded-lg border border-dashed border-slate-300 p-3 text-sm">
              <RichText text={teks} />
            </div>
          )}
          <div className="mt-4">
            <Label className="mb-2 block text-xs text-slate-500">Gambar pendukung tambahan (ditampilkan di bawah soal, opsional)</Label>
            <ImageUpload value={media} onChange={setMedia} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="bobot">Bobot</Label>
            <Input id="bobot" type="number" min={1} value={bobot} onChange={(e) => setBobot(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tingkatKesulitan">Tingkat kesulitan</Label>
            <select
              id="tingkatKesulitan"
              className={selectClassName}
              value={tingkatKesulitan}
              onChange={(e) => setTingkatKesulitan(e.target.value as (typeof KESULITAN_OPTIONS)[number])}
            >
              {KESULITAN_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="levelBloom">Level kognitif</Label>
            <select
              id="levelBloom"
              className={selectClassName}
              value={levelBloom}
              onChange={(e) => setLevelBloom(e.target.value)}
            >
              {LEVEL_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="materiId">Materi</Label>
            <select
              id="materiId"
              required
              className={selectClassName}
              value={materiId}
              onChange={(e) => {
                setMateriId(e.target.value);
                setSubMateriId("");
                setKompetensiId("");
              }}
            >
              <option value="">Pilih materi</option>
              {materiList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nama}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="subMateriId">Sub materi</Label>
            <select
              id="subMateriId"
              required
              disabled={!materiId}
              className={selectClassName}
              value={subMateriId}
              onChange={(e) => {
                setSubMateriId(e.target.value);
                setKompetensiId("");
              }}
            >
              <option value="">Pilih sub materi</option>
              {subMateriList.map((sm) => (
                <option key={sm.id} value={sm.id}>
                  {sm.nama}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="kompetensiId">Kompetensi</Label>
            <select
              id="kompetensiId"
              required
              disabled={!subMateriId}
              className={selectClassName}
              value={kompetensiId}
              onChange={(e) => setKompetensiId(e.target.value)}
            >
              <option value="">Pilih kompetensi</option>
              {kompetensiList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.kode} - {k.deskripsi}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(format === "pg" || format === "pg_kompleks") && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>
                Opsi jawaban {format === "pg" ? "(pilih 1 kunci)" : "(centang semua kunci)"}
              </Label>
              {format === "pg_kompleks" && (
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={addOption}>
                    Tambah opsi
                  </Button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {options.map((opt, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                  <input
                    type={format === "pg" ? "radio" : "checkbox"}
                    name="correct-option"
                    checked={opt.isCorrect}
                    onChange={() => toggleCorrect(i)}
                    className="mt-2 accent-indigo-600"
                  />
                  <span className="mt-2 w-5 font-mono text-sm text-slate-500">{opt.label}</span>
                  <div className="flex-1">
                    <Input
                      id={`opt-teks-${i}`}
                      required
                      placeholder="Teks opsi (rumus: $x^2$)"
                      value={opt.teks}
                      onChange={(e) => updateOption(i, { teks: e.target.value })}
                    />
                    <FormatToolbar inputId={`opt-teks-${i}`} value={opt.teks} setter={(val) => updateOption(i, { teks: val })} />
                    {opt.teks && (
                      <div className="mt-2 rounded-lg border border-dashed border-slate-300 p-2 text-sm">
                        <RichText text={opt.teks} />
                      </div>
                    )}
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      <Label className="mb-1 block text-xs text-slate-500">Gambar opsi (opsional)</Label>
                      <ImageUpload value={opt.media} onChange={(url) => updateOption(i, { media: url })} />
                    </div>
                  </div>
                  {format === "pg_kompleks" && options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {format === "pg_kategori" && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Pernyataan (maks. 3, kolom kategori tetap Benar/Salah)</Label>
              <Button type="button" variant="secondary" onClick={addStatement} disabled={statements.length >= 3}>
                Tambah pernyataan
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              {statements.map((s, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <Input
                        id={`s-teks-${i}`}
                        required
                        placeholder="Teks pernyataan (rumus: $x^2$)"
                        value={s.teks}
                        onChange={(e) => updateStatement(i, { teks: e.target.value })}
                      />
                      <FormatToolbar inputId={`s-teks-${i}`} value={s.teks} setter={(val) => updateStatement(i, { teks: val })} />
                      {s.teks && (
                        <div className="mt-2 rounded-lg border border-dashed border-slate-300 p-2 text-sm">
                          <RichText text={s.teks} />
                        </div>
                      )}
                      <div className="mt-2 border-t border-slate-100 pt-2">
                        <Label className="mb-1 block text-xs text-slate-500">Gambar pernyataan (opsional)</Label>
                        <ImageUpload value={s.media} onChange={(url) => updateStatement(i, { media: url })} />
                      </div>
                    </div>
                    {statements.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStatement(i)}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex gap-4 text-sm">
                    {(["Benar", "Salah"] as const).map((cat) => (
                      <label key={cat} className="flex items-center gap-1">
                        <input
                          type="radio"
                          name={`statement-${i}-category`}
                          checked={s.correctCategory === cat}
                          onChange={() => updateStatement(i, { correctCategory: cat })}
                          className="accent-indigo-600"
                        />
                        {cat}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="pembahasan">Pembahasan (opsional)</Label>
          <textarea
            id="pembahasan"
            rows={3}
            className={selectClassName}
            value={pembahasan}
            onChange={(e) => setPembahasan(e.target.value)}
          />
        </div>

        <Button type="submit" disabled={submitting} className="w-fit">
          {submitting ? "Menyimpan..." : "Simpan soal"}
        </Button>
      </form>
    </Card>
  );
}
