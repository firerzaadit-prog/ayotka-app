import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Permintaan user (12 Okt 2026): halaman hasil/rapor di web TANPA watermark; watermark (nama siswa) hanya ada di rapor PDF.
 * Tes ini menjaga arah itu di kode sumber; perilaku watermark di PDF diuji di rapor-pdf-identitas.test.ts.
 */
const baca = (p: string) => readFileSync(p, "utf8");
/** Buang komentar (yang boleh menjelaskan keputusan ini) supaya yang diperiksa hanya kode. */
const tanpaKomentar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("watermark hanya di PDF", () => {
  it("halaman hasil siswa di web tidak punya watermark, lapisan latar berulang, maupun data nama untuk itu", () => {
    const halaman = tanpaKomentar(baca("app/siswa/(shell)/hasil/[id]/page.tsx"));
    expect(halaman).not.toMatch(/watermark/i);
    expect(halaman).not.toContain("backgroundImage");
    expect(halaman).not.toContain("image/svg+xml");
    expect(halaman).not.toMatch(/pointer-events-none absolute inset-0/);
  });

  it("tidak ada komponen web lain yang memasang watermark nama siswa", () => {
    for (const berkas of [
      "components/hasil/rincian-jawaban.tsx",
      "components/hasil/ranking-board.tsx",
      "components/siswa/riwayat-siswa-view.tsx",
      "components/ai/learning-analytics-siswa.tsx",
    ]) {
      const sumber = tanpaKomentar(baca(berkas));
      // komentar boleh menyebut watermark; yang tidak boleh adalah kode yang menggambarnya
      expect(sumber, berkas).not.toMatch(/backgroundImage|rotate\(-28|watermark/i);
    }
  });

  it("rapor PDF tetap memasang watermark", () => {
    const renderer = baca("lib/pdf/rapor-renderer.ts");
    expect(renderer).toContain("function drawWatermark");
    expect(renderer).toMatch(/drawWatermark\(doc, watermarkLabel, fonts\)/);
    expect(renderer).toContain("hasil.siswa.idSamar");
  });
});
