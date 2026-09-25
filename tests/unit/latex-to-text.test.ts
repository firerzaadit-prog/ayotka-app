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

/**
 * Laporan bug lanjutan: rapor PDF masih menampilkan "5x^2 - 3x + 8", "L_1",
 * "(1)/(3)", "65^" (dari 65^\circ) dan "\1, 2, 3\" (dari \{1, 2, 3\}) - versi
 * sebelumnya membuang perintah yang tak dikenali dan tidak paham grup
 * bersarang. Mode unicode dipakai kalau font DejaVu berhasil dimuat.
 */
describe("latexToPlainText - mode unicode (font DejaVu)", () => {
  const u = (s: string) => latexToPlainText(s, { unicode: true });

  it("pangkat & indeks jadi superskrip/subskrip", () => {
    expect(u("$5x^2 - 3x + 8$")).toBe("5x² - 3x + 8");
    expect(u("$L_1$ dan $L_{2}$")).toBe("L₁ dan L₂");
    expect(u("$10^{-3}$")).toBe("10⁻³");
    expect(u("$x^{n+1}$")).toBe("xⁿ⁺¹");
  });

  it("pecahan sederhana jadi karakter pecahan, sisanya pakai garis miring dengan kurung seperlunya", () => {
    expect(u("sebanyak $\\frac{1}{3}$ bagian")).toBe("sebanyak ⅓ bagian");
    expect(u("$\\frac{15}{8}$")).toBe("¹⁵⁄₈");
    expect(u("$\\frac{x}{2}$")).toBe("x/2");
    expect(u("$\\frac{3x+2}{5}$")).toBe("(3x+2)/5");
  });

  it("derajat dari ^\\circ (dulu tersisa '65^')", () => {
    expect(u("sudut $65^\\circ$")).toBe("sudut 65°");
    expect(u("sudut $65^{\\circ}$")).toBe("sudut 65°");
  });

  it("kurung kurawal himpunan \\{ \\} tidak hilang jadi backslash", () => {
    expect(u("$\\{1, 2, 3, 4, 5, 6\\}$")).toBe("{1, 2, 3, 4, 5, 6}");
    expect(latexToPlainText("$\\{1, 2, 3\\}$")).toBe("{1, 2, 3}");
  });

  it("simbol matematika asli", () => {
    expect(u("$\\pi \\times r^2$")).toBe("π × r²");
    expect(u("$a \\leq b \\neq c$")).toBe("a ≤ b ≠ c");
    expect(u("$\\angle ABC \\perp \\checkmark$")).toBe("∠ ABC ⊥ ✓");
  });

  it("akar kuadrat & akar dengan ekspresi", () => {
    expect(u("$\\sqrt{16}$")).toBe("√16");
    expect(u("$\\sqrt{x+1}$")).toBe("√(x+1)");
    expect(u("$\\sqrt[3]{27}$")).toBe("∛27");
  });

  it("tidak ada sisa sintaks LaTeX di soal nyata", () => {
    const out = u("$\\frac{\\sqrt{a^2+b^2}}{2} \\text{ cm}$ dan $\\left(x+1\\right)^{2}$");
    expect(out).not.toMatch(/[\\{}$^_]/);
    expect(out).toContain("cm");
  });
});

describe("latexToPlainText - mode aman font default (WinAnsi)", () => {
  it("hanya memakai karakter WinAnsi untuk pangkat & pecahan", () => {
    expect(latexToPlainText("$x^2$ dan $y^3$")).toBe("x² dan y³");
    expect(latexToPlainText("$\\frac{1}{2}$")).toBe("½");
    expect(latexToPlainText("$\\frac{1}{3}$")).toBe("1/3");
    expect(latexToPlainText("$10^{-3}$")).toBe("10^(-3)");
    expect(latexToPlainText("$L_1$")).toBe("L_1");
    expect(latexToPlainText("$65^\\circ$")).toBe("65°");
  });
});

describe("latexToPlainText - markup non-LaTeX", () => {
  it("tag perataan [center] dilucuti termasuk yang tinggal sebelah", () => {
    expect(latexToPlainText("[center]Halo[/center]")).toBe("Halo");
    expect(latexToPlainText("Sebelum [center]")).toBe("Sebelum");
    expect(latexToPlainText("[/center] Sesudah")).toBe("Sesudah");
  });

  it("tanda < dan > matematika biasa tidak ikut terhapus sebagai tag HTML", () => {
    expect(latexToPlainText("Jika 3 < x dan y > 2 maka benar")).toBe("Jika 3 < x dan y > 2 maka benar");
    expect(latexToPlainText("Teks <b>tebal</b> biasa")).toBe("Teks tebal biasa");
  });
});
