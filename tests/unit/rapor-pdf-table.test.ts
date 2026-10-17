import PDFDocument from "pdfkit";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { setupFonts } from "@/lib/pdf/pdf-umum";
import { gambarSoal } from "@/lib/pdf/rapor-renderer";

afterEach(() => vi.restoreAllMocks());

describe("PDF Rapor - render tabel dan heading markdown pada stimulus/soal", () => {
  it("merender heading tanpa '###' dan tabel sebagai sel terpisah tanpa baris pemisah pipe mentah '|---|'", async () => {
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
    const printedTexts: string[] = [];
    const origText = doc.text.bind(doc);

    vi.spyOn(doc, "text").mockImplementation(((...args: unknown[]) => {
      if (typeof args[0] === "string") {
        printedTexts.push(args[0]);
      }
      return (origText as (...a: unknown[]) => unknown)(...args);
    }) as never);

    const fonts = setupFonts(doc);

    const soalContoh = {
      questionId: "q-1",
      format: "pg" as const,
      teks: "Berapakah total saldo akhir tabungan Andi?",
      media: null,
      stimulus: {
        id: "stim-1",
        tipe: "teks" as const,
        judul: "Stimulus Bacaan/Data TKA (SMP - Matematika)",
        konten: `### Program Tabungan Berencana Siswa (TBS)

Berikut adalah data tiga siswa yang mengikuti program tersebut:

| Nama Siswa | Saldo Awal (Rp) | Setoran Bulanan (Rp) | Target Akhir (Rp) |
| :--- | :--- | :--- | :--- |
| Andi | 50.000 | 15.000 | 150.000 |
| Budi | 20.000 | 25.000 | 180.000 |

Ketentuan Tambahan:
1. Koperasi memberikan bonus bunga.`,
      },
      pembahasan: "Langkah 1: Hitung total setoran.",
      tingkatKesulitan: "sedang" as const,
      kompetensiNama: "Aljabar",
      paketNama: "Paket TKA Matematika",
      hierarki: {
        namaMapel: "Matematika",
        jumlahTingkat: 4 as const,
        items: [
          { label: "Elemen", nilai: "Aljabar" },
          { label: "Subelemen", nilai: "Barisan dan Deret" },
        ],
      },
      skor: 1,
      skorMaks: 1,
      categories: [],
      options: [
        { id: "opt-1", label: "A", teks: "Rp140.000", isCorrect: false },
        { id: "opt-2", label: "B", teks: "Rp146.000", isCorrect: true },
      ],
      statements: [],
      jawabanJson: { option_id: "opt-2" },
      raguRagu: false,
    };

    await gambarSoal(doc, fonts, soalContoh, 1, true);

    // 1. Heading harus tercetak TANPA tanda "###"
    expect(printedTexts).toContain("Program Tabungan Berencana Siswa (TBS)");
    expect(printedTexts.some((t) => t.includes("###"))).toBe(false);

    // 2. Kolom tabel header dan data harus tercetak
    expect(printedTexts).toContain("Nama Siswa");
    expect(printedTexts).toContain("Saldo Awal (Rp)");
    expect(printedTexts).toContain("Andi");
    expect(printedTexts).toContain("50.000");
    expect(printedTexts).toContain("Budi");

    // 3. Garis pemisah tabel markdown "| :--- |" TIDAK boleh tercetak sebagai teks mentah
    expect(printedTexts.some((t) => t.includes(":---") || t.includes("|---|"))).toBe(false);

    // 4. Baris bertanda pipe mentah "| Nama Siswa |" TIDAK boleh tercetak mentah dengan pipe
    expect(printedTexts.some((t) => t.includes("| Nama Siswa |"))).toBe(false);
  });

  it("merender kotak hierarki indikator dengan teks panjang bertingkat tanpa bentrok", async () => {
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
    const printedTexts: string[] = [];
    const origText = doc.text.bind(doc);

    vi.spyOn(doc, "text").mockImplementation(((...args: unknown[]) => {
      if (typeof args[0] === "string") {
        printedTexts.push(args[0]);
      }
      return (origText as (...a: unknown[]) => unknown)(...args);
    }) as never);

    const fonts = setupFonts(doc);

    const soalPanjang = {
      questionId: "q-2",
      format: "pg" as const,
      teks: "Soal dengan kompetensi dan indikator sangat panjang.",
      media: null,
      stimulus: null,
      pembahasan: "Pembahasan singkat.",
      tingkatKesulitan: "sedang" as const,
      kompetensiNama: "Bilangan",
      paketNama: "Paket TKA",
      hierarki: {
        namaMapel: "Matematika",
        jumlahTingkat: 4 as const,
        items: [
          { label: "Elemen", nilai: "Bilangan" },
          { label: "Subelemen", nilai: "Bilangan Real" },
          {
            label: "Kompetensi",
            nilai:
              "Kemampuan memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait perbandingan dan sifat-sifat bilangan",
          },
          {
            label: "Indikator",
            nilai:
              "Menentukan suku ke-n (lebih dari 3 suku berikutnya dari yang diketahui) dari pola bilangan berdasarkan konfigurasi objek tersebut (14)",
          },
        ],
      },
      skor: 1,
      skorMaks: 1,
      categories: [],
      options: [
        { id: "opt-1", label: "A", teks: "Jawaban A", isCorrect: true },
      ],
      statements: [],
      jawabanJson: { option_id: "opt-1" },
      raguRagu: false,
    };

    await gambarSoal(doc, fonts, soalPanjang, 2, true);

    expect(printedTexts).toContain("Hierarki Indikator");
    expect(printedTexts).toContain("Matematika (4 Tingkat)");
    expect(printedTexts).toContain("Elemen:");
    expect(printedTexts).toContain("Bilangan");
    expect(printedTexts).toContain("Subelemen:");
    expect(printedTexts).toContain("Bilangan Real");
    expect(printedTexts).toContain("Kompetensi:");
    expect(printedTexts).toContain("Indikator:");
  });
});
