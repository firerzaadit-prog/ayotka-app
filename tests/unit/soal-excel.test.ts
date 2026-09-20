import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

vi.mock("server-only", () => ({}));

import {
  questionsToRows,
  resolveHeaders,
  rowsToQuestions,
  type ExcelRow,
  type ExportQuestion,
  type KompetensiRef,
} from "@/lib/soal/excel-format";
import { buildSoalWorkbook, readSoalSheet } from "@/lib/soal/excel-io";

const KOMP = new Map<string, KompetensiRef>([
  [
    "mtk.bil.real.l1",
    {
      id: "11111111-1111-4111-8111-111111111111",
      materiId: "22222222-2222-4222-8222-222222222222",
      subMateriId: "33333333-3333-4333-8333-333333333333",
    },
  ],
]);

const pgRow: ExcelRow = {
  format: "pg",
  teks: "Nilai $x$ jika $2x = 8$ adalah ...",
  kompetensi: "MTK.BIL.REAL.L1",
  kesulitan: "Mudah",
  level: "L1",
  bobot: "2",
  opsi_a: "2",
  opsi_b: "4",
  opsi_c: "6",
  opsi_d: "8",
  kunci: "B",
};
const wrap = (cells: ExcelRow, row = 2) => [{ row, cells }];

describe("rowsToQuestions - baris valid", () => {
  it("pg: kunci menjadi isCorrect, kode kompetensi tidak peka huruf besar/kecil, ID materi diturunkan", () => {
    const { questions, errors } = rowsToQuestions(wrap(pgRow), KOMP);
    expect(errors).toEqual([]);
    const q = questions[0]!.data;
    expect(q.options.map((o) => [o.label, o.isCorrect])).toEqual([
      ["A", false],
      ["B", true],
      ["C", false],
      ["D", false],
    ]);
    expect(q.tingkatKesulitan).toBe("mudah");
    expect(q.bobot).toBe(2);
    expect(q.materiId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("pg_kompleks: beberapa kunci dipisah koma/titik koma/spasi", () => {
    for (const kunci of ["A,C", "a;c", "A C", "A, C"]) {
      const { questions, errors } = rowsToQuestions(wrap({ ...pgRow, format: "PG Kompleks", kunci }), KOMP);
      expect(errors).toEqual([]);
      expect(
        questions[0]!.data.options.filter((o) => o.isCorrect).map((o) => o.label),
      ).toEqual(["A", "C"]);
    }
  });

  it("pg_kategori: 1-3 pernyataan, Benar/Salah (juga B/S)", () => {
    const { questions, errors } = rowsToQuestions(
      wrap({
        format: "pg_kategori",
        teks: "Tentukan",
        kompetensi: "MTK.BIL.REAL.L1",
        kesulitan: "sedang",
        level: "2",
        pernyataan_1: "P1",
        jawaban_1: "benar",
        pernyataan_2: "P2",
        jawaban_2: "S",
      }),
      KOMP,
    );
    expect(errors).toEqual([]);
    expect(questions[0]!.data.statements.map((s) => s.correctCategory)).toEqual(["Benar", "Salah"]);
    expect(questions[0]!.data.levelBloom).toBe("L2");
  });

  it("bobot kosong = 1", () => {
    const { questions } = rowsToQuestions(wrap({ ...pgRow, bobot: "" }), KOMP);
    expect(questions[0]!.data.bobot).toBe(1);
  });
});

describe("rowsToQuestions - kesalahan dilaporkan lengkap dengan baris & kolom", () => {
  const pesan = (cells: ExcelRow) => rowsToQuestions(wrap(cells, 7), KOMP).errors;

  it("kode kompetensi tidak dikenal", () => {
    const e = pesan({ ...pgRow, kompetensi: "TIDAK-ADA" });
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ row: 7, kolom: "Kode Kompetensi" });
  });

  it("opsi bercelah (B kosong, C terisi)", () => {
    const e = pesan({ ...pgRow, opsi_b: "" });
    expect(e.some((x) => x.kolom === "Opsi B")).toBe(true);
  });

  it("pg dengan dua kunci, kunci di luar opsi, dan kunci kosong", () => {
    expect(pesan({ ...pgRow, kunci: "A,B" }).some((x) => x.pesan.includes("tepat 1"))).toBe(true);
    expect(pesan({ ...pgRow, kunci: "E" }).some((x) => x.pesan.includes("tidak cocok"))).toBe(true);
    expect(pesan({ ...pgRow, kunci: "" }).some((x) => x.kolom === "Kunci Jawaban")).toBe(true);
  });

  it("pg butuh 4-5 opsi", () => {
    const e = pesan({ ...pgRow, opsi_d: "", kunci: "A" });
    expect(e.some((x) => x.pesan.includes("4-5 opsi"))).toBe(true);
  });

  it("enum, angka, dan media tidak valid", () => {
    const e = pesan({ ...pgRow, format: "essay", kesulitan: "gampang", level: "L9", bobot: "0", media: "gambar.png" });
    expect(e.map((x) => x.kolom).sort()).toEqual(
      ["Bobot", "Format", "Level Kognitif", "Media Soal", "Tingkat Kesulitan"].sort(),
    );
  });

  it("pg_kategori: jawaban hilang, nilai salah, atau tanpa pernyataan", () => {
    const base: ExcelRow = {
      format: "pg_kategori",
      teks: "T",
      kompetensi: "MTK.BIL.REAL.L1",
      kesulitan: "mudah",
      level: "L1",
    };
    expect(pesan({ ...base, pernyataan_1: "P", jawaban_1: "" })[0]!.kolom).toBe("Jawaban 1");
    expect(pesan({ ...base, pernyataan_1: "P", jawaban_1: "mungkin" })[0]!.kolom).toBe("Jawaban 1");
    expect(pesan({ ...base })[0]!.kolom).toBe("Pernyataan 1");
  });

  it("mengumpulkan kesalahan dari SEMUA baris, bukan berhenti di yang pertama", () => {
    const { errors, questions } = rowsToQuestions(
      [
        { row: 2, cells: { ...pgRow, kunci: "" } },
        { row: 3, cells: pgRow },
        { row: 4, cells: { ...pgRow, kompetensi: "X" } },
      ],
      KOMP,
    );
    expect(errors.map((e) => e.row).sort()).toEqual([2, 4]);
    expect(questions.map((q) => q.row)).toEqual([3]);
  });
});

describe("resolveHeaders", () => {
  it("mengenali judul tanpa peduli huruf/spasi/sinonim, dan melaporkan kolom wajib yang hilang", () => {
    const r = resolveHeaders(["NO", "jenis soal", "SOAL", "Kompetensi", "kesulitan", "Level", "Kolom Aneh"]);
    expect(r.missing).toEqual([]);
    expect(r.unknown).toEqual(["Kolom Aneh"]);
    expect(resolveHeaders(["No", "Teks Soal"]).missing).toContain("Kode Kompetensi");
  });
});

const exported: ExportQuestion[] = [
  {
    format: "pg",
    teks: "Baris satu\nBaris dua dengan $\\frac{a}{b}$ dan ![](https://x.test/g.png)",
    media: "https://x.test/m.png",
    bobot: 3,
    tingkatKesulitan: "sulit",
    levelBloom: "L3",
    pembahasan: "Karena $a=b$.",
    kompetensiKode: "MTK.BIL.REAL.L1",
    options: [
      { teks: "$1$", media: null, isCorrect: false, urutan: 0 },
      { teks: "$2$", media: null, isCorrect: true, urutan: 1 },
      { teks: "$3$", media: null, isCorrect: false, urutan: 2 },
      { teks: "$4$", media: null, isCorrect: false, urutan: 3 },
    ],
    statements: [],
  },
  {
    format: "pg_kompleks",
    teks: "Pilih semua",
    media: null,
    bobot: 2,
    tingkatKesulitan: "sedang",
    levelBloom: "L2",
    pembahasan: null,
    kompetensiKode: "MTK.BIL.REAL.L1",
    options: [
      { teks: "a", media: null, isCorrect: true, urutan: 0 },
      { teks: "b", media: null, isCorrect: false, urutan: 1 },
      { teks: "c", media: null, isCorrect: true, urutan: 2 },
    ],
    statements: [],
  },
  {
    format: "pg_kategori",
    teks: "Benar/Salah",
    media: null,
    bobot: 1,
    tingkatKesulitan: "mudah",
    levelBloom: "L1",
    pembahasan: null,
    kompetensiKode: "MTK.BIL.REAL.L1",
    options: [],
    statements: [
      { teks: "S1", media: null, urutan: 0, correctLabel: "Benar" },
      { teks: "S2", media: null, urutan: 1, correctLabel: "Salah" },
    ],
  },
];

describe("ekspor -> impor bolak-balik", () => {
  it("baris hasil ekspor lolos impor dan isinya sama (LaTeX, baris baru, gambar markdown, bobot)", () => {
    const rows = questionsToRows(exported).map((cells, i) => ({ row: i + 2, cells }));
    const { questions, errors } = rowsToQuestions(rows, KOMP);
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(3);
    const [a, b, c] = questions.map((q) => q.data);
    expect(a!.teks).toBe(exported[0]!.teks);
    expect(a!.media).toBe("https://x.test/m.png");
    expect(a!.bobot).toBe(3);
    expect(a!.options.map((o) => o.teks)).toEqual(["$1$", "$2$", "$3$", "$4$"]);
    expect(a!.options.find((o) => o.isCorrect)!.teks).toBe("$2$");
    expect(b!.options.filter((o) => o.isCorrect).map((o) => o.label)).toEqual(["A", "C"]);
    expect(c!.statements.map((s) => [s.teks, s.correctCategory])).toEqual([
      ["S1", "Benar"],
      ["S2", "Salah"],
    ]);
  });
});

describe("file .xlsx sungguhan", () => {
  it("dibangun lalu dibaca kembali dengan hasil identik", async () => {
    const buffer = await buildSoalWorkbook({
      judul: "PAKET A",
      questions: exported,
      template: false,
      kompetensi: [
        { kode: "MTK.BIL.REAL.L1", deskripsi: "d", levelKognitif: "L1", materi: "Bilangan", subMateri: "Real", tingkat: 9 },
      ],
    });

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- typing Buffer exceljs
    await wb.xlsx.load(buffer as any);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Soal", "Petunjuk", "Referensi Kompetensi"]);
    expect(wb.getWorksheet("Soal")!.getCell("B2").dataValidation.type).toBe("list");
    expect(wb.getWorksheet("Soal")!.getCell("D2").dataValidation.formulae![0]).toContain("Referensi Kompetensi");

    const sheet = await readSoalSheet(buffer);
    expect(sheet.missingHeaders).toEqual([]);
    expect(sheet.rows).toHaveLength(3);
    const { questions, errors } = rowsToQuestions(sheet.rows, KOMP);
    expect(errors).toEqual([]);
    expect(questions[0]!.data.teks).toBe(exported[0]!.teks);
    expect(questions[0]!.data.pembahasan).toBe("Karena $a=b$.");
  });

  it("template: baris CONTOH dilewati, sehingga template utuh tidak menyimpan soal apa pun", async () => {
    const buffer = await buildSoalWorkbook({ judul: "T", questions: [], template: true, kompetensi: [] });
    const sheet = await readSoalSheet(buffer);
    expect(sheet.rows).toEqual([]);
  });

  it("membaca sel angka, teks kaya, rumus, dan mengabaikan baris yang hanya berisi nomor", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Soal");
    ws.addRow([
      "No", "Format", "Teks Soal", "Kode Kompetensi", "Tingkat Kesulitan", "Level Kognitif", "Bobot",
      "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci Jawaban",
    ]);
    ws.addRow([
      1, "pg", { richText: [{ text: "Teks " }, { text: "kaya", font: { bold: true } }] },
      "MTK.BIL.REAL.L1", "mudah", "L1", 2, 5, "6", { formula: "3+4", result: 7 }, 8, "B",
    ]);
    ws.addRow([2]);
    const buffer = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

    const sheet = await readSoalSheet(buffer);
    expect(sheet.rows).toHaveLength(1);
    const { questions, errors } = rowsToQuestions(sheet.rows, KOMP);
    expect(errors).toEqual([]);
    const q = questions[0]!.data;
    expect(q.teks).toBe("Teks kaya");
    expect(q.bobot).toBe(2);
    expect(q.options.map((o) => o.teks)).toEqual(["5", "6", "7", "8"]);
  });
});
