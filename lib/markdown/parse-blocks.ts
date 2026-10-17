/**
 * Parser blok Markdown ringan untuk konten soal, stimulus, dan pembahasan.
 * Digunakan bersama oleh RichText (web) dan PDFKit rapor renderer (PDF).
 */

export type Block =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "bullet"; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "hr" };

/**
 * Sisipkan pemisah paragraf (baris kosong) sebelum pola yang menandai butir
 * baru - persis aturan yang dipakai soal.ayotka.id (LatexPreview.tsx) supaya
 * soal panjang (PG Kompleks, PG Kategori, pembahasan) tidak menggumpal jadi
 * satu paragraf.
 */
export function applyReadabilityBreaks(text: string): string {
  let t = text;
  // (a) Sebelum penomoran butir: 1) ..., 2. ..., (3) ... - ":" sengaja tidak
  // termasuk pemisah supaya rasio/waktu (40 : 10) atau 08:30 tidak terpecah.
  t = t.replace(
    /([.);!?]|benar|salah|tepat)\s+(?=(?:Pernyataan\s+|Langkah\s+)?(?:\d+[).-]\s+|\(\d+\)\s+|\[\d+\]\s+))/gi,
    "$1\n\n",
  );
  // (b) Sebelum label opsi: A), B., (A), [A], Opsi A, Pilihan A
  t = t.replace(
    /([.);!?]|benar|salah|tepat|\d)\s+(?=(?:Opsi\s+|Pilihan\s+|Pernyataan\s+)?[A-E][).:-]\s+|\([A-E]\)\s+|\[[A-E]\]\s+)/gi,
    "$1\n\n",
  );
  // (c) Sebelum tahapan: Langkah 1:, Pernyataan 1:, Tahap 1:, Kasus 1:
  t = t.replace(
    /([.);!?]|benar|salah|tepat)\s+(?=(?:Langkah|Pernyataan|Tahap|Kasus)\s+\d+[:.\s])/gi,
    "$1\n\n",
  );
  // (d) Sebelum kata kunci struktur: Diketahui, Ditanya, Penyelesaian, dst.
  t = t.replace(
    /([.);!?]|benar|salah|tepat)\s+(?=(?:Diketahui|Ditanya|Dijawab|Penyelesaian|Rumus|Analisis|Simpulan|Kesimpulan)[:\s])/gi,
    "$1\n\n",
  );
  // (e) Sebelum kalimat deduksi lanjutan: Maka, Sehingga, Jadi, dst.
  t = t.replace(
    /([.);!?]|benar|salah|tepat)\s+(?=(?:Selisih|Maka|Sehingga|Jadi|Dengan demikian|Berdasarkan perhitungan)\s+)/gi,
    "$1\n",
  );
  // (f) Sebelum catatan dalam kurung: (Koreksi: ...), (Catatan: ...)
  t = t.replace(/\s+(?=\((?:Koreksi|Catatan):)/gi, "\n");
  return t;
}

export function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let paragraphLines: string[] = [];
  let bulletItems: string[] = [];
  let tableRows: string[][] = [];

  const flushParagraph = () => {
    const joined = paragraphLines.join("\n").trim();
    if (joined) blocks.push({ type: "paragraph", text: joined });
    paragraphLines = [];
  };
  const flushBullets = () => {
    if (bulletItems.length > 0) blocks.push({ type: "bullet", items: bulletItems });
    bulletItems = [];
  };
  const flushTable = () => {
    if (tableRows.length > 0) {
      const [header, ...rows] = tableRows;
      blocks.push({ type: "table", header: header ?? [], rows });
    }
    tableRows = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushBullets();
    flushTable();
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const tableCells = parseTableRow(line);
    if (tableCells) {
      flushParagraph();
      flushBullets();
      if (!isTableDivider(line)) tableRows.push(tableCells);
      continue;
    }
    flushTable();

    if (line.length === 0) {
      flushParagraph();
      flushBullets();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushBullets();
      blocks.push({ type: "heading", level: headingMatch[1]!.length, text: headingMatch[2]! });
      continue;
    }

    if (/^[-*_]{3,}$/.test(line)) {
      flushParagraph();
      flushBullets();
      blocks.push({ type: "hr" });
      continue;
    }

    const bulletMatch = /^[-*•]\s+(.*)$/.exec(line);
    if (bulletMatch) {
      flushParagraph();
      bulletItems.push(bulletMatch[1]!);
      continue;
    }
    flushBullets();

    paragraphLines.push(rawLine);
  }
  flushAll();

  return blocks;
}

export function parseTableRow(line: string): string[] | null {
  if (!line.startsWith("|") || !line.endsWith("|") || line.length < 2) return null;
  return line.slice(1, -1).split("|").map((c) => c.trim());
}

export function isTableDivider(line: string): boolean {
  return /^\|(\s*:?-+:?\s*\|)+$/.test(line);
}
