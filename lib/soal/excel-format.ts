import { questionCreateSchema } from "@/lib/validations/question";

/**
 * Format Excel untuk impor/ekspor soal (satu baris = satu soal). Modul ini
 * murni (tanpa I/O Excel/DB) supaya aturan validasinya bisa dites terpisah -
 * pembacaan/penulisan file .xlsx ada di lib/soal/excel-io.ts.
 */

export const OPSI_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

export type ColKey =
  | "no"
  | "format"
  | "teks"
  | "kompetensi"
  | "kesulitan"
  | "level"
  | "bobot"
  | "media"
  | "pembahasan"
  | "opsi_a" | "opsi_b" | "opsi_c" | "opsi_d" | "opsi_e" | "opsi_f" | "opsi_g" | "opsi_h"
  | "kunci"
  | "pernyataan_1" | "jawaban_1"
  | "pernyataan_2" | "jawaban_2"
  | "pernyataan_3" | "jawaban_3";

export type Kolom = { key: ColKey; header: string; width: number };

export const KOLOM_SOAL: Kolom[] = [
  { key: "no", header: "No", width: 6 },
  { key: "format", header: "Format", width: 14 },
  { key: "teks", header: "Teks Soal", width: 60 },
  { key: "kompetensi", header: "Kode Kompetensi", width: 20 },
  { key: "kesulitan", header: "Tingkat Kesulitan", width: 16 },
  { key: "level", header: "Level Kognitif", width: 14 },
  { key: "bobot", header: "Bobot", width: 8 },
  { key: "media", header: "Media Soal", width: 30 },
  { key: "pembahasan", header: "Pembahasan", width: 50 },
  ...OPSI_LABELS.map((l) => ({ key: `opsi_${l.toLowerCase()}` as ColKey, header: `Opsi ${l}`, width: 28 })),
  { key: "kunci", header: "Kunci Jawaban", width: 14 },
  { key: "pernyataan_1", header: "Pernyataan 1", width: 40 },
  { key: "jawaban_1", header: "Jawaban 1", width: 12 },
  { key: "pernyataan_2", header: "Pernyataan 2", width: 40 },
  { key: "jawaban_2", header: "Jawaban 2", width: 12 },
  { key: "pernyataan_3", header: "Pernyataan 3", width: 40 },
  { key: "jawaban_3", header: "Jawaban 3", width: 12 },
];

export type ExcelRow = Partial<Record<ColKey, string>>;

export const REQUIRED_KEYS: ColKey[] = ["format", "teks", "kompetensi", "kesulitan", "level"];

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Nama kolom yang dikenali (huruf besar/kecil & tanda baca diabaikan), termasuk beberapa sinonim umum. */
const HEADER_ALIASES: Record<string, ColKey> = (() => {
  const map: Record<string, ColKey> = {};
  for (const k of KOLOM_SOAL) map[normalizeHeader(k.header)] = k.key;
  Object.assign(map, {
    nomor: "no",
    jenissoal: "format",
    formatsoal: "format",
    soal: "teks",
    pertanyaan: "teks",
    kompetensi: "kompetensi",
    kesulitan: "kesulitan",
    level: "level",
    levelbloom: "level",
    skor: "bobot",
    gambar: "media",
    kunci: "kunci",
  });
  return map;
})();

/** Petakan baris judul sheet ke key kolom; kolom yang tidak dikenali diabaikan (dilaporkan sebagai unknown). */
export function resolveHeaders(headerCells: string[]): {
  keys: Array<ColKey | null>;
  unknown: string[];
  missing: string[];
} {
  const keys = headerCells.map((h) => HEADER_ALIASES[normalizeHeader(h)] ?? null);
  const unknown = headerCells.filter((h, i) => h.trim() !== "" && keys[i] === null);
  const present = new Set(keys.filter(Boolean));
  const missing = REQUIRED_KEYS.filter((k) => !present.has(k)).map(
    (k) => KOLOM_SOAL.find((c) => c.key === k)!.header,
  );
  return { keys, unknown, missing };
}

export type RowError = { row: number; kolom: string; pesan: string };

export type ParsedQuestion = {
  format: "pg" | "pg_kompleks" | "pg_kategori";
  teks: string;
  media: string | null;
  bobot: number;
  tingkatKesulitan: "mudah" | "sedang" | "sulit";
  kompetensiId: string;
  materiId: string;
  subMateriId: string;
  levelBloom: "L1" | "L2" | "L3";
  pembahasan: string | null;
  options: { label: string; teks: string; media: null; isCorrect: boolean; urutan: number }[];
  statements: { teks: string; media: null; correctCategory: "Benar" | "Salah"; urutan: number }[];
};

export type KompetensiRef = { id: string; materiId: string; subMateriId: string };

/** Untuk mendeteksi soal yang sama saat impor ulang - spasi/huruf besar-kecil diabaikan. */
export function normalizeTeks(t: string): string {
  return t.replace(/\s+/g, " ").trim().toLowerCase();
}

const FORMAT_ALIASES: Record<string, ParsedQuestion["format"]> = {
  pg: "pg",
  pilihan_ganda: "pg",
  pg_kompleks: "pg_kompleks",
  pilihan_ganda_kompleks: "pg_kompleks",
  kompleks: "pg_kompleks",
  pg_kategori: "pg_kategori",
  kategori: "pg_kategori",
  benar_salah: "pg_kategori",
};

const PLACEHOLDER_PACKAGE_ID = "00000000-0000-4000-8000-000000000000";

const val = (row: ExcelRow, key: ColKey) => (row[key] ?? "").trim();
export const headerOf = (key: ColKey) => KOLOM_SOAL.find((c) => c.key === key)!.header;

/**
 * Validasi & ubah baris-baris sheet menjadi soal siap simpan. Mengumpulkan
 * SEMUA kesalahan (bukan berhenti di yang pertama) supaya pengguna bisa
 * memperbaiki seluruh file sekaligus - kalau ada satu saja kesalahan, pemanggil
 * tidak menyimpan apa pun (semua-atau-tidak-sama-sekali).
 */
export function rowsToQuestions(
  rows: Array<{ row: number; cells: ExcelRow }>,
  kompetensiByKode: Map<string, KompetensiRef>,
): { questions: Array<{ row: number; data: ParsedQuestion }>; errors: RowError[] } {
  const questions: Array<{ row: number; data: ParsedQuestion }> = [];
  const errors: RowError[] = [];

  for (const { row, cells } of rows) {
    const err = (key: ColKey, pesan: string) => errors.push({ row, kolom: headerOf(key), pesan });
    const before = errors.length;

    const formatRaw = val(cells, "format").toLowerCase().replace(/[\s-]+/g, "_");
    const format = FORMAT_ALIASES[formatRaw];
    if (!format) {
      err("format", `Format "${val(cells, "format")}" tidak dikenal. Isi: pg, pg_kompleks, atau pg_kategori.`);
    }

    const teks = val(cells, "teks");
    if (!teks) err("teks", "Teks soal wajib diisi.");

    const kode = val(cells, "kompetensi");
    const kompetensi = kode ? kompetensiByKode.get(kode.toLowerCase()) : undefined;
    if (!kode) err("kompetensi", "Kode kompetensi wajib diisi.");
    else if (!kompetensi) err("kompetensi", `Kode kompetensi "${kode}" tidak ada untuk mata pelajaran paket ini. Lihat sheet "Referensi Kompetensi".`);

    const kesulitan = val(cells, "kesulitan").toLowerCase();
    if (!["mudah", "sedang", "sulit"].includes(kesulitan)) {
      err("kesulitan", `Tingkat kesulitan "${val(cells, "kesulitan")}" tidak valid. Isi: mudah, sedang, atau sulit.`);
    }

    const levelRaw = val(cells, "level").toUpperCase().replace(/^L?/, "L");
    if (!["L1", "L2", "L3"].includes(levelRaw)) {
      err("level", `Level kognitif "${val(cells, "level")}" tidak valid. Isi: L1, L2, atau L3.`);
    }

    let bobot = 1;
    const bobotRaw = val(cells, "bobot");
    if (bobotRaw !== "") {
      const n = Number(bobotRaw);
      if (!Number.isInteger(n) || n < 1) err("bobot", `Bobot "${bobotRaw}" harus bilangan bulat minimal 1 (kosongkan untuk 1).`);
      else bobot = n;
    }

    const media = val(cells, "media");
    if (media && !/^https?:\/\//i.test(media)) {
      err("media", "Media Soal harus berupa URL gambar (diawali http:// atau https://).");
    }

    const options: ParsedQuestion["options"] = [];
    const statements: ParsedQuestion["statements"] = [];

    if (format === "pg" || format === "pg_kompleks") {
      const filled = OPSI_LABELS.map((l) => val(cells, `opsi_${l.toLowerCase()}` as ColKey));
      const lastFilled = filled.reduce((acc, t, i) => (t ? i : acc), -1);
      let gap = false;
      for (let i = 0; i <= lastFilled; i++) {
        if (!filled[i]) {
          err(`opsi_${OPSI_LABELS[i]!.toLowerCase()}` as ColKey, `Opsi ${OPSI_LABELS[i]} kosong padahal Opsi ${OPSI_LABELS[lastFilled]} terisi - isi berurutan tanpa celah.`);
          gap = true;
        }
      }
      const count = lastFilled + 1;
      const [min, max] = format === "pg" ? [4, 5] : [2, 8];
      if (!gap && (count < min || count > max)) {
        err("kunci", `Format ${format} butuh ${min}-${max} opsi, tetapi terisi ${count}.`);
      }

      const kunciRaw = val(cells, "kunci");
      const tokens = kunciRaw.toUpperCase().split(/[\s,;/&]+/).filter(Boolean);
      const unique = [...new Set(tokens)];
      if (unique.length === 0) {
        err("kunci", "Kunci jawaban wajib diisi (huruf opsi yang benar, mis. B atau A,C).");
      } else {
        for (const t of unique) {
          const idx = OPSI_LABELS.indexOf(t as (typeof OPSI_LABELS)[number]);
          if (idx < 0 || idx > lastFilled) err("kunci", `Kunci "${t}" tidak cocok dengan opsi yang terisi.`);
        }
        if (format === "pg" && unique.length !== 1) err("kunci", "Format pg harus punya tepat 1 kunci jawaban.");
      }

      if (!gap) {
        for (let i = 0; i <= lastFilled; i++) {
          options.push({
            label: OPSI_LABELS[i]!,
            teks: filled[i]!,
            media: null,
            isCorrect: unique.includes(OPSI_LABELS[i]!),
            urutan: i,
          });
        }
      }
    }

    if (format === "pg_kategori") {
      for (let n = 1; n <= 3; n++) {
        const pKey = `pernyataan_${n}` as ColKey;
        const jKey = `jawaban_${n}` as ColKey;
        const p = val(cells, pKey);
        const j = val(cells, jKey).toLowerCase();
        if (!p && !j) continue;
        if (!p) {
          err(pKey, `Pernyataan ${n} kosong padahal Jawaban ${n} terisi.`);
          continue;
        }
        const jawaban = j === "benar" || j === "b" ? "Benar" : j === "salah" || j === "s" ? "Salah" : null;
        if (!jawaban) {
          err(jKey, `Jawaban ${n} harus "Benar" atau "Salah".`);
          continue;
        }
        statements.push({ teks: p, media: null, correctCategory: jawaban, urutan: statements.length });
      }
      if (statements.length === 0) err("pernyataan_1", "Format pg_kategori butuh minimal 1 pernyataan beserta jawabannya.");
    }

    if (errors.length > before || !format || !kompetensi) continue;

    const data: ParsedQuestion = {
      format,
      teks,
      media: media || null,
      bobot,
      tingkatKesulitan: kesulitan as ParsedQuestion["tingkatKesulitan"],
      kompetensiId: kompetensi.id,
      materiId: kompetensi.materiId,
      subMateriId: kompetensi.subMateriId,
      levelBloom: levelRaw as ParsedQuestion["levelBloom"],
      pembahasan: val(cells, "pembahasan") || null,
      options,
      statements,
    };

    // Jaring pengaman: aturan skema yang sama dengan form input soal manual.
    const check = questionCreateSchema.safeParse({
      ...data,
      // Skema form manual memakai "" (bukan null) untuk pembahasan kosong.
      pembahasan: data.pembahasan ?? "",
      packageId: PLACEHOLDER_PACKAGE_ID,
      ...(format === "pg_kategori" ? { options: undefined } : { statements: undefined }),
    });
    if (!check.success) {
      const issue = check.error.issues[0];
      errors.push({ row, kolom: "-", pesan: `${issue?.message ?? "Data soal tidak valid."}${issue?.path.length ? ` (${issue.path.join(".")})` : ""}` });
      continue;
    }
    questions.push({ row, data });
  }

  return { questions, errors };
}

export type ExportQuestion = {
  format: ParsedQuestion["format"];
  teks: string;
  media: string | null;
  bobot: number;
  tingkatKesulitan: string;
  levelBloom: string;
  pembahasan: string | null;
  kompetensiKode: string;
  options: { teks: string; media: string | null; isCorrect: boolean; urutan: number }[];
  statements: { teks: string; media: string | null; urutan: number; correctLabel: string }[];
};

/** Media per opsi/pernyataan tidak punya kolom sendiri di Excel - disisipkan sebagai gambar markdown di teksnya supaya tidak hilang. */
const withMedia = (teks: string, media: string | null) => (media ? `${teks}\n![](${media})` : teks);

export function questionsToRows(questions: ExportQuestion[]): ExcelRow[] {
  return questions.map((q, i) => {
    const row: ExcelRow = {
      no: String(i + 1),
      format: q.format,
      teks: q.teks,
      kompetensi: q.kompetensiKode,
      kesulitan: q.tingkatKesulitan,
      level: q.levelBloom,
      bobot: String(q.bobot),
      media: q.media ?? "",
      pembahasan: q.pembahasan ?? "",
    };
    if (q.format === "pg" || q.format === "pg_kompleks") {
      const opts = [...q.options].sort((a, b) => a.urutan - b.urutan);
      opts.forEach((o, idx) => {
        const label = OPSI_LABELS[idx];
        if (label) row[`opsi_${label.toLowerCase()}` as ColKey] = withMedia(o.teks, o.media);
      });
      row.kunci = opts
        .map((o, idx) => (o.isCorrect ? OPSI_LABELS[idx] : null))
        .filter(Boolean)
        .join(",");
    } else {
      [...q.statements]
        .sort((a, b) => a.urutan - b.urutan)
        .slice(0, 3)
        .forEach((s, idx) => {
          row[`pernyataan_${idx + 1}` as ColKey] = withMedia(s.teks, s.media);
          row[`jawaban_${idx + 1}` as ColKey] = s.correctLabel;
        });
    }
    return row;
  });
}
