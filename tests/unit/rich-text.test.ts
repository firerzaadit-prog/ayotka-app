import { describe, expect, it } from "vitest";
import { applyReadabilityBreaks, parseBlocks, parseSegments } from "@/components/soal/rich-text";

describe("applyReadabilityBreaks - pemisah paragraf sebelum butir baru (disamakan dengan soal.ayotka.id)", () => {
  it("memisah sebelum penomoran butir: 1), 2., (3)", () => {
    const hasil = applyReadabilityBreaks("Perhatikan pernyataan berikut. 1) Bumi bulat. 2) Matahari terbit di barat.");
    expect(hasil).toContain(".\n\n1) Bumi");
    expect(hasil).toContain(".\n\n2) Matahari");
  });

  it("TIDAK memisah rasio atau jam yang memakai titik dua (bukan pemisah)", () => {
    const hasil = applyReadabilityBreaks("Perbandingannya adalah 40 : 10 dan dimulai pukul 08:30.");
    expect(hasil).not.toContain("\n\n");
  });

  it("memisah sebelum label opsi: A), B., (C), [D]", () => {
    const hasil = applyReadabilityBreaks("Manakah yang benar? A) Satu. B) Dua.");
    expect(hasil).toContain("?\n\nA) Satu.");
    expect(hasil).toContain(".\n\nB) Dua.");
  });

  it("tidak memisah label opsi berikutnya kalau tidak didahului tanda baca/kata kunci (batasan yang sama dengan soal.ayotka.id - opsi biasanya disimpan terpisah per butir, bukan digabung satu string)", () => {
    const hasil = applyReadabilityBreaks("Manakah yang benar? A) Satu B) Dua");
    expect(hasil).toContain("?\n\nA) Satu B) Dua");
  });

  it("memisah sebelum Langkah/Pernyataan/Tahap/Kasus bernomor", () => {
    const hasil = applyReadabilityBreaks("Ikuti langkah berikut. Langkah 1: siapkan alat. Langkah 2: mulai.");
    expect(hasil).toContain(".\n\nLangkah 1:");
    expect(hasil).toContain(".\n\nLangkah 2:");
  });

  it("memisah sebelum kata kunci struktur: Diketahui, Ditanya, Penyelesaian", () => {
    const hasil = applyReadabilityBreaks("Soal cerita. Diketahui: panjang 5 cm. Ditanya: luasnya?");
    expect(hasil).toContain(".\n\nDiketahui:");
    expect(hasil).toContain(".\n\nDitanya:");
  });

  it("tidak mengubah teks yang memang sudah satu kalimat sederhana", () => {
    const hasil = applyReadabilityBreaks("Berapakah hasil dari 6 x 7?");
    expect(hasil).toBe("Berapakah hasil dari 6 x 7?");
  });
});

describe("parseBlocks - level blok (paragraf, heading, bullet, tabel)", () => {
  it("teks tanpa pemisah menjadi satu blok paragraf", () => {
    const blocks = parseBlocks("Ini soal sederhana.");
    expect(blocks).toEqual([{ type: "paragraph", text: "Ini soal sederhana." }]);
  });

  it("baris kosong ganda memisah jadi beberapa paragraf", () => {
    const blocks = parseBlocks("Paragraf satu.\n\nParagraf dua.");
    expect(blocks).toEqual([
      { type: "paragraph", text: "Paragraf satu." },
      { type: "paragraph", text: "Paragraf dua." },
    ]);
  });

  it("heading Markdown (#, ##, ...) dikenali dengan levelnya", () => {
    const blocks = parseBlocks("# Judul Utama\nIsi soal.");
    expect(blocks[0]).toEqual({ type: "heading", level: 1, text: "Judul Utama" });
    expect(blocks[1]).toEqual({ type: "paragraph", text: "Isi soal." });
  });

  it("baris berawalan -, *, atau • dikumpulkan jadi satu blok bullet", () => {
    const blocks = parseBlocks("- Poin pertama\n- Poin kedua\n* Poin ketiga");
    expect(blocks).toEqual([{ type: "bullet", items: ["Poin pertama", "Poin kedua", "Poin ketiga"] }]);
  });

  it("baris bertanda pipe (|) dirangkai jadi tabel, baris pemisah (---) diabaikan", () => {
    const blocks = parseBlocks("| Nama | Nilai |\n|---|---|\n| Budi | 80 |\n| Ani | 90 |");
    expect(blocks).toEqual([
      {
        type: "table",
        header: ["Nama", "Nilai"],
        rows: [
          ["Budi", "80"],
          ["Ani", "90"],
        ],
      },
    ]);
  });

  it("garis tiga strip atau lebih (---, ***) menjadi blok hr", () => {
    const blocks = parseBlocks("Teks atas\n\n---\n\nTeks bawah");
    expect(blocks).toEqual([
      { type: "paragraph", text: "Teks atas" },
      { type: "hr" },
      { type: "paragraph", text: "Teks bawah" },
    ]);
  });
});

describe("parseSegments - level inline (rumus, gambar, alignment, badge)", () => {
  it("rumus inline $...$ dan blok $$...$$ dikenali beda tipe", () => {
    const inline = parseSegments("Nilai $x$ adalah 5");
    expect(inline.some((s) => s.type === "inline" && s.value === "x")).toBe(true);

    const block = parseSegments("$$x^2 + 1$$");
    expect(block[0]).toEqual({ type: "block", value: "x^2 + 1" });
  });

  it("gambar Markdown ![alt](url) dikenali sebagai segmen image", () => {
    const segs = parseSegments("Lihat ![grafik](https://x.test/a.png) di atas");
    expect(segs.some((s) => s.type === "image" && s.value === "https://x.test/a.png" && s.alt === "grafik")).toBe(true);
  });

  it("tag [center]...[/center] dikenali sebagai segmen align, bukan sekadar dibuang", () => {
    const segs = parseSegments("[center]Teks tengah[/center]");
    expect(segs[0]).toMatchObject({ type: "align", align: "center" });
  });

  it("(Benar) dan (Salah) dikenali sebagai badge, tidak peka huruf besar/kecil", () => {
    const segs = parseSegments("Pernyataan ini (benar) sedangkan itu (SALAH)");
    expect(segs.some((s) => s.type === "badge" && s.value === "benar")).toBe(true);
    expect(segs.some((s) => s.type === "badge" && s.value === "salah")).toBe(true);
  });

  it("**tebal** dan *miring* tetap dikenali seperti sebelumnya", () => {
    const segs = parseSegments("**penting** dan *catatan*");
    expect(segs.some((s) => s.type === "bold")).toBe(true);
    expect(segs.some((s) => s.type === "italic")).toBe(true);
  });
});
