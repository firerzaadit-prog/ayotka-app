import { describe, expect, it } from "vitest";
import { latexToPlainText } from "@/lib/pdf/latex-to-text";

/**
 * Kasus di sini persis dari laporan bug: rapor PDF menampilkan source
 * KaTeX mentah ("$...$", "\div", "\text{...}", "\checkmark") apa adanya
 * karena pdfkit tidak bisa merender KaTeX seperti komponen RichText di
 * layar (components/soal/rich-text.tsx).
 */
describe("latexToPlainText", () => {
  it("membuang delimiter $ dan mengubah simbol umum jadi teks biasa", () => {
    expect(latexToPlainText("Hasil dari hitung $-15 + (-12) \\div 3$ adalah ...")).toBe(
      "Hasil dari hitung -15 + (-12) ÷ 3 adalah ...",
    );
  });

  it("melepas \\text{...} dan tetap menyisakan isinya", () => {
    expect(
      latexToPlainText("Panjang taman adalah $(3x - 5)\\text{ m}$ dan lebarnya $(x + 2) \\text{ m}$."),
    ).toBe("Panjang taman adalah (3x - 5) m dan lebarnya (x + 2) m.");
  });

  it("mengubah \\checkmark jadi padanan ASCII yang aman di font PDF default", () => {
    expect(latexToPlainText("Berilah tanda centang ($\\checkmark$) pada kolom yang sesuai.")).toBe(
      "Berilah tanda centang ((v)) pada kolom yang sesuai.",
    );
  });

  it("menangani beberapa segmen $...$ sekaligus dalam satu teks", () => {
    expect(latexToPlainText("Diketahui $P = 5x - 2y + 4$ dan $Q = 2x + 3y - 1$.")).toBe(
      "Diketahui P = 5x - 2y + 4 dan Q = 2x + 3y - 1.",
    );
  });

  it("tidak membocorkan perintah LaTeX yang belum ditangani eksplisit", () => {
    const out = latexToPlainText("$\\sqrt{16} + \\frac{1}{2}$");
    expect(out).not.toContain("\\");
    expect(out).not.toContain("{");
    expect(out).not.toContain("}");
  });

  it("teks tanpa LaTeX sama sekali tidak berubah", () => {
    expect(latexToPlainText("Ibu kota Indonesia adalah Jakarta.")).toBe(
      "Ibu kota Indonesia adalah Jakarta.",
    );
  });
});
