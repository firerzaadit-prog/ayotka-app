import "server-only";
import ExcelJS from "exceljs";
import {
  KOLOM_SOAL,
  questionsToRows,
  resolveHeaders,
  type ColKey,
  type ExcelRow,
  type ExportQuestion,
} from "@/lib/soal/excel-format";

export const SHEET_SOAL = "Soal";
export const SHEET_PETUNJUK = "Petunjuk";
export const SHEET_REFERENSI = "Referensi Kompetensi";
/** Baris contoh di template ditandai "CONTOH" di kolom No - dilewati saat impor supaya tidak ikut tersimpan. */
export const PENANDA_CONTOH = "contoh";
export const MAKS_BARIS_IMPOR = 300;

export type KompetensiReferensi = {
  kode: string;
  deskripsi: string;
  levelKognitif: string;
  materi: string;
  subMateri: string;
  tingkat: number;
};

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
const TEXT_KEYS = new Set<ColKey>([
  "teks", "pembahasan", "media", "kunci", "kompetensi",
  "opsi_a", "opsi_b", "opsi_c", "opsi_d", "opsi_e", "opsi_f", "opsi_g", "opsi_h",
  "pernyataan_1", "pernyataan_2", "pernyataan_3",
]);
const BARIS_TERFORMAT = 500;

const PETUNJUK: string[] = [
  "PETUNJUK PENGISIAN - satu baris = satu soal. Isi di sheet \"Soal\", mulai dari baris 2.",
  "",
  "Kolom wajib: Format, Teks Soal, Kode Kompetensi, Tingkat Kesulitan, Level Kognitif.",
  "",
  "FORMAT (pilih dari dropdown):",
  "  pg          = pilihan ganda, 4-5 opsi, TEPAT 1 jawaban benar. Kunci Jawaban: satu huruf, mis. B",
  "  pg_kompleks = pilihan ganda kompleks, 2-8 opsi, boleh lebih dari 1 benar. Kunci Jawaban: huruf dipisah koma, mis. A,C",
  "  pg_kategori = pernyataan Benar/Salah, 1-3 pernyataan. Isi Pernyataan 1-3 dan Jawaban 1-3 (Benar atau Salah). Kolom Opsi & Kunci dikosongkan.",
  "",
  "Kode Kompetensi: pilih dari dropdown atau lihat sheet \"Referensi Kompetensi\" (harus persis sama).",
  "Tingkat Kesulitan: mudah / sedang / sulit.   Level Kognitif: L1 / L2 / L3.   Bobot: bilangan bulat >= 1 (kosong = 1).",
  "Media Soal (opsional): URL gambar diawali https://.  Gambar di dalam teks/opsi ditulis dengan sintaks ![](https://alamat-gambar).",
  "Rumus matematika ditulis dengan LaTeX di antara tanda dolar, mis. $x^2 + 3x = 10$. Baris baru di dalam sel boleh (Alt+Enter).",
  "Opsi diisi berurutan dari Opsi A tanpa celah (tidak boleh Opsi B kosong tetapi Opsi C terisi).",
  "",
  "SAAT IMPOR:",
  "  - Semua baris diperiksa dulu. Kalau ada SATU saja yang salah, tidak ada soal yang disimpan dan semua kesalahan ditampilkan (nomor baris + kolom).",
  "  - Soal yang teksnya sama persis dengan soal yang sudah ada di paket dilewati (aman untuk impor ulang, tidak jadi dobel).",
  "  - Soal BARU ditambahkan ke paket; soal yang sudah ada tidak diubah atau dihapus. Untuk mengubah soal lama, edit lewat halaman soal.",
  "  - Baris yang kolom No-nya berisi \"CONTOH\" diabaikan (dipakai di template). Maksimal 300 soal per file.",
  "  - Gambar per opsi tidak punya kolom sendiri - pakai sintaks ![](url) di teks opsinya.",
];

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle", wrapText: true };
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: "thin", color: { argb: "FF6366F1" } } };
  });
}

export async function buildSoalWorkbook(params: {
  judul: string;
  questions: ExportQuestion[];
  kompetensi: KompetensiReferensi[];
  template: boolean;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AyoTKA";

  // --- Sheet Soal ---
  const ws = wb.addWorksheet(SHEET_SOAL, { views: [{ state: "frozen", ySplit: 1, xSplit: 3 }] });
  ws.columns = KOLOM_SOAL.map((k) => ({ header: k.header, key: k.key, width: k.width }));
  styleHeader(ws.getRow(1));

  let rows: ExcelRow[] = params.template ? [] : questionsToRows(params.questions);
  if (params.template) {
    const kode = params.kompetensi[0]?.kode ?? "KODE-KOMPETENSI";
    rows = [
      {
        no: "CONTOH", format: "pg", teks: "Hasil dari $2x + 3$ untuk $x = 4$ adalah ...", kompetensi: kode,
        kesulitan: "mudah", level: "L1", bobot: "1", pembahasan: "Substitusi x = 4: 2(4) + 3 = 11.",
        opsi_a: "9", opsi_b: "10", opsi_c: "11", opsi_d: "12", kunci: "C",
      },
      {
        no: "CONTOH", format: "pg_kompleks", teks: "Pilih SEMUA bilangan prima berikut.", kompetensi: kode,
        kesulitan: "sedang", level: "L2", bobot: "2",
        opsi_a: "2", opsi_b: "4", opsi_c: "7", opsi_d: "9", kunci: "A,C",
      },
      {
        no: "CONTOH", format: "pg_kategori", teks: "Tentukan Benar atau Salah untuk tiap pernyataan.", kompetensi: kode,
        kesulitan: "sedang", level: "L2", bobot: "3",
        pernyataan_1: "$3 \\times 4 = 12$", jawaban_1: "Benar",
        pernyataan_2: "$15 : 3 = 4$", jawaban_2: "Salah",
      },
    ];
  }
  for (const r of rows) ws.addRow(KOLOM_SOAL.map((k) => r[k.key] ?? ""));

  // Kolom teks diformat Teks supaya isian seperti "1/2" atau "3-4" tidak diubah Excel jadi tanggal.
  const lastRow = Math.max(BARIS_TERFORMAT, rows.length + 1);
  for (let r = 2; r <= lastRow; r++) {
    KOLOM_SOAL.forEach((k, idx) => {
      const cell = ws.getCell(r, idx + 1);
      if (TEXT_KEYS.has(k.key)) cell.numFmt = "@";
      cell.alignment = { vertical: "top", wrapText: true };
    });
  }

  const colOf = (key: ColKey) => KOLOM_SOAL.findIndex((k) => k.key === key) + 1;
  const dropdown = (key: ColKey, formula: string) => {
    const c = colOf(key);
    for (let r = 2; r <= lastRow; r++) {
      ws.getCell(r, c).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: "Nilai tidak dikenal",
        error: "Pilih salah satu dari daftar.",
      };
    }
  };
  dropdown("format", '"pg,pg_kompleks,pg_kategori"');
  dropdown("kesulitan", '"mudah,sedang,sulit"');
  dropdown("level", '"L1,L2,L3"');
  dropdown("jawaban_1", '"Benar,Salah"');
  dropdown("jawaban_2", '"Benar,Salah"');
  dropdown("jawaban_3", '"Benar,Salah"');
  if (params.kompetensi.length > 0) {
    dropdown("kompetensi", `'${SHEET_REFERENSI}'!$A$2:$A$${params.kompetensi.length + 1}`);
  }

  // --- Sheet Petunjuk ---
  const wp = wb.addWorksheet(SHEET_PETUNJUK);
  wp.getColumn(1).width = 130;
  PETUNJUK.forEach((line, i) => {
    const cell = wp.getCell(i + 1, 1);
    cell.value = line;
    cell.alignment = { wrapText: true, vertical: "top" };
    if (i === 0) cell.font = { bold: true, size: 13 };
  });
  wp.getCell(PETUNJUK.length + 2, 1).value = `Paket: ${params.judul}`;

  // --- Sheet Referensi Kompetensi ---
  const wr = wb.addWorksheet(SHEET_REFERENSI, { views: [{ state: "frozen", ySplit: 1 }] });
  wr.columns = [
    { header: "Kode Kompetensi", key: "kode", width: 24 },
    { header: "Deskripsi", key: "deskripsi", width: 60 },
    { header: "Level Kognitif", key: "level", width: 14 },
    { header: "Tingkat", key: "tingkat", width: 9 },
    { header: "Materi", key: "materi", width: 26 },
    { header: "Sub Materi", key: "subMateri", width: 30 },
  ];
  styleHeader(wr.getRow(1));
  for (const k of params.kompetensi) {
    wr.addRow({ kode: k.kode, deskripsi: k.deskripsi, level: k.levelKognitif, tingkat: k.tingkat, materi: k.materi, subMateri: k.subMateri });
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as unknown as Record<string, unknown>;
    if (Array.isArray(v.richText)) return (v.richText as Array<{ text?: string }>).map((r) => r.text ?? "").join("");
    if ("result" in v) return cellToString(v.result as ExcelJS.CellValue);
    if ("text" in v) return cellToString(v.text as ExcelJS.CellValue);
    if ("error" in v) return "";
  }
  return String(value);
}

export type SheetParseResult = {
  rows: Array<{ row: number; cells: ExcelRow }>;
  unknownHeaders: string[];
  missingHeaders: string[];
  sheetName: string;
};

/** Baca sheet "Soal" (atau sheet pertama). Baris kosong & baris CONTOH dilewati. */
export async function readSoalSheet(buffer: Buffer): Promise<SheetParseResult> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exceljs's Buffer typing predates @types/node's ArrayBufferLike generic; identical shape at runtime.
  await wb.xlsx.load(buffer as any);
  const ws = wb.getWorksheet(SHEET_SOAL) ?? wb.worksheets[0];
  if (!ws) throw new Error("File Excel kosong.");

  const headerRow = ws.getRow(1);
  const headerCells: string[] = [];
  for (let c = 1; c <= ws.columnCount; c++) headerCells.push(cellToString(headerRow.getCell(c).value).trim());
  const { keys, unknown, missing } = resolveHeaders(headerCells);

  const rows: SheetParseResult["rows"] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: ExcelRow = {};
    let anyValue = false;
    keys.forEach((key, idx) => {
      if (!key) return;
      const text = cellToString(row.getCell(idx + 1).value);
      // Kolom "No" saja tidak cukup untuk dianggap baris berisi (mis. nomor sudah diketik duluan).
      if (key !== "no" && text.trim() !== "") anyValue = true;
      cells[key] = text;
    });
    if (!anyValue) continue;
    if ((cells.no ?? "").trim().toLowerCase() === PENANDA_CONTOH) continue;
    rows.push({ row: r, cells });
  }

  return { rows, unknownHeaders: unknown, missingHeaders: missing, sheetName: ws.name };
}

