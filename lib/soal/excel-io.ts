import "server-only";
import ExcelJS from "exceljs";
import {
  KOLOM_SOAL,
  headerOf,
  questionsToRows,
  resolveHeaders,
  type ColKey,
  type ExcelRow,
  type ExportQuestion,
  type RowError,
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
  "",
  "GAMBAR (3 cara, boleh dicampur):",
  "  1. TEMPEL LANGSUNG di Excel: Insert > Pictures > \"Place Over Cells\" (atau copy-paste gambar), lalu geser supaya POJOK KIRI-ATAS gambar berada di sel tujuan.",
  "     Bisa di kolom Teks Soal, Pembahasan, Media Soal, Opsi A-H, atau Pernyataan 1-3. JANGAN pakai \"Place in Cell\" (gambar di dalam sel) - tidak terbaca.",
  "  2. LINK GOOGLE DRIVE: tempel link \"Bagikan\" biasa di kolom Media Soal, atau ![](link-drive) di dalam teks. Akses file harus \"Siapa saja yang memiliki link\". Gambar diunduh dan disimpan di sistem.",
  "  3. LINK GAMBAR LAIN (https://...): di Media Soal, atau ![](https://...) di dalam teks. Gambar tetap ada di alamat aslinya (tidak disalin).",
  "  Posisi gambar di tengah teks: tulis penanda [gambar] di tempat gambar harus muncul, mis. \"Perhatikan gambar [gambar] lalu hitung luasnya.\"",
  "     Kalau ada 2 gambar di satu sel: [gambar 1] dan [gambar 2] (urutan = dari atas ke bawah). Gambar tanpa penanda dilekatkan di akhir teks.",
  "  Media Soal hanya boleh 1 gambar. Format gambar: PNG, JPEG, WEBP, atau GIF, maks 5 MB per gambar.",
  "  Gambar baru disimpan HANYA kalau seluruh file lolos pemeriksaan.",
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

/** Kolom yang boleh berisi gambar tempelan (kolom lain tidak punya tempat untuk gambar). */
export const KOLOM_GAMBAR: ReadonlySet<ColKey> = new Set<ColKey>([
  "teks", "pembahasan", "media",
  "opsi_a", "opsi_b", "opsi_c", "opsi_d", "opsi_e", "opsi_f", "opsi_g", "opsi_h",
  "pernyataan_1", "pernyataan_2", "pernyataan_3",
]);

export type GambarTempel = { buffer: Buffer };
export type GambarPerKolom = Partial<Record<ColKey, GambarTempel[]>>;
export type BarisSheet = { row: number; cells: ExcelRow; gambar: GambarPerKolom };

export type SheetParseResult = {
  rows: BarisSheet[];
  unknownHeaders: string[];
  missingHeaders: string[];
  sheetName: string;
  /** Gambar yang diletakkan di tempat yang tidak bisa dipakai (kolom salah, baris kosong, dll). */
  gambarBermasalah: RowError[];
  /** Ada gambar model "Place in Cell" (Excel 365) - tidak bisa dibaca, harus diubah jadi "Place over Cells". */
  gambarDiDalamSel: boolean;
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

  // Gambar yang ditempel: dikelompokkan per (baris, kolom) berdasarkan pojok kiri-atas gambar.
  // Urutan dalam satu sel = dari atas ke bawah lalu kiri ke kanan (dipakai penanda [gambar 1], [gambar 2]).
  const gambarPerSel = new Map<string, Array<{ order: number; buffer: Buffer }>>();
  for (const im of ws.getImages()) {
    const media = wb.getImage(Number(im.imageId));
    const tl = im.range.tl as { nativeRow: number; nativeCol: number; row?: number; col?: number };
    if (!media?.buffer) continue;
    const key = `${tl.nativeRow + 1}:${tl.nativeCol + 1}`;
    const list = gambarPerSel.get(key) ?? [];
    list.push({ order: (tl.row ?? tl.nativeRow) * 1000 + (tl.col ?? tl.nativeCol), buffer: Buffer.from(media.buffer as unknown as Uint8Array) });
    gambarPerSel.set(key, list);
  }

  const gambarBermasalah: RowError[] = [];
  const barisAdaGambar = new Set<number>();
  for (const key of gambarPerSel.keys()) {
    const [r, c] = key.split(":").map(Number) as [number, number];
    barisAdaGambar.add(r);
    const colKey = keys[c - 1] ?? null;
    if (r === 1) {
      gambarBermasalah.push({ row: 1, kolom: "-", pesan: "Ada gambar di baris judul (baris 1). Letakkan gambar di baris soal (baris 2 ke bawah)." });
    } else if (!colKey) {
      gambarBermasalah.push({ row: r, kolom: "-", pesan: `Ada gambar di kolom yang bukan kolom soal (kolom ke-${c}). Letakkan gambar di kolom Teks Soal, Media Soal, Opsi, Pernyataan, atau Pembahasan.` });
    } else if (!KOLOM_GAMBAR.has(colKey)) {
      gambarBermasalah.push({ row: r, kolom: headerOf(colKey), pesan: `Kolom ${headerOf(colKey)} tidak bisa berisi gambar. Gambar hanya boleh di Teks Soal, Media Soal, Opsi A-H, Pernyataan 1-3, atau Pembahasan.` });
    }
  }

  const rows: SheetParseResult["rows"] = [];
  const barisTerbaca = new Set<number>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: ExcelRow = {};
    const gambar: GambarPerKolom = {};
    let anyValue = false;
    keys.forEach((key, idx) => {
      if (!key) return;
      const text = cellToString(row.getCell(idx + 1).value);
      // Kolom "No" saja tidak cukup untuk dianggap baris berisi (mis. nomor sudah diketik duluan).
      if (key !== "no" && text.trim() !== "") anyValue = true;
      cells[key] = text;
      const g = gambarPerSel.get(`${r}:${idx + 1}`);
      if (g && KOLOM_GAMBAR.has(key)) {
        gambar[key] = g.sort((a, b) => a.order - b.order).map((x) => ({ buffer: x.buffer }));
        anyValue = true;
      }
    });
    if (!anyValue) continue;
    if ((cells.no ?? "").trim().toLowerCase() === PENANDA_CONTOH) continue;
    barisTerbaca.add(r);
    rows.push({ row: r, cells, gambar });
  }

  // Gambar di baris yang tidak dianggap soal (mis. baris kosong di antara soal): jangan dibuang diam-diam.
  for (const r of barisAdaGambar) {
    if (r === 1 || barisTerbaca.has(r)) continue;
    const noCell = keys.findIndex((k) => k === "no");
    const isContoh = noCell >= 0 && cellToString(ws.getRow(r).getCell(noCell + 1).value).trim().toLowerCase() === PENANDA_CONTOH;
    if (!isContoh && !gambarBermasalah.some((e) => e.row === r)) {
      gambarBermasalah.push({ row: r, kolom: "-", pesan: "Ada gambar di baris ini, tetapi baris ini tidak berisi soal." });
    }
  }

  // Excel 365 "Place in Cell" menyimpan gambar di struktur lain (richData) yang tidak terbaca pustaka kami.
  const gambarDiDalamSel = buffer.includes("xl/richData/richValueRel.xml");

  return { rows, unknownHeaders: unknown, missingHeaders: missing, sheetName: ws.name, gambarBermasalah, gambarDiDalamSel };
}
