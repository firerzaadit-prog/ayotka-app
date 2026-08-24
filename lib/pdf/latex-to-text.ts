/**
 * Tiket 5.8: teks soal/opsi/pembahasan bisa mengandung rumus KaTeX
 * (`$...$` inline, `$$...$$` block - lihat components/soal/rich-text.tsx,
 * dipakai di layar). pdfkit tidak bisa merender KaTeX sama sekali, jadi di
 * PDF dikonversi jadi notasi matematika teks-biasa yang tetap terbaca -
 * bukan typeset sempurna, tapi jangan sampai source LaTeX mentah
 * (`\div`, `\text{...}`, `$`) bocor apa adanya ke rapor yang diunduh.
 */
export function latexToPlainText(text: string): string {
  return text
    .replace(/\$\$([^$]+)\$\$/g, (_, inner: string) => latexInnerToText(inner))
    .replace(/\$([^$]+)\$/g, (_, inner: string) => latexInnerToText(inner))
    .replace(/<[^>]+>/g, "")
    // spasi ganda sering muncul setelah \text{ ... } dilepas (mis. "$X
    // \text{ m}$" - ada spasi di dua sisi) - dirapikan jadi satu spasi.
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function latexInnerToText(latex: string): string {
  const result = latex
    // Simbol di bawah ini dibatasi ke yang didukung font default PDF
    // (WinAnsiEncoding, pdfkit tidak embed font Unicode penuh) - simbol
    // di luar itu (mis. √, ≤, ≥, ✓) tampil sebagai karakter acak kalau
    // dipaksakan, jadi diganti padanan ASCII yang aman.
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^}]*)\}/g, "sqrt($1)")
    .replace(/\\div/g, "÷")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\pm/g, "±")
    .replace(/\\leq/g, "<=")
    .replace(/\\geq/g, ">=")
    .replace(/\\neq/g, "!=")
    .replace(/\\approx/g, "~=")
    .replace(/\\checkmark/g, "(v)")
    .replace(/\^\{([^}]*)\}/g, "^($1)")
    .replace(/_\{([^}]*)\}/g, "_($1)")
    // jaring pengaman: perintah LaTeX lain yang belum ditangani eksplisit
    // di atas dibuang saja (lebih baik hilang daripada bocor sebagai
    // "\namaperintah" mentah), sisa kurung kurawal ikut dibuang.
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[{}]/g, "");

  return result.trim();
}
