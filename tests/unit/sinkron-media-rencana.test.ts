import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { rencanaMediaGanda } from "@/lib/soal-import/sinkron-media";
import { MediaIlustrasi } from "@/components/soal/media-ilustrasi";
import { formatQuestionMedia, parseQuestionMedia } from "@/lib/soal/media-types";
import type { SourceGambar } from "@/lib/soal-import/media";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>`;
const FOTO = "https://ayotka.id/media/soal-media/abc123.jpg";
const KETERANGAN = "Dua bangun datar segiempat: Bangun (1) belah ketupat, Bangun (2) layang-layang.";

const kontekstual = (o: Partial<SourceGambar> = {}): SourceGambar => ({
  tipe: "ilustrasi_kontekstual",
  svg_fallback: SVG,
  url: "https://soal.ayotka.id/soal-images/sumber.png",
  deskripsi_alt: KETERANGAN,
  ...o,
});

function perbarui(gambar: SourceGambar | null, media: string | null) {
  const r = rencanaMediaGanda(gambar, media);
  if (r.aksi !== "perbarui") throw new Error(`diharapkan perbarui, dapat ${JSON.stringify(r)}`);
  return r.mediaBaru;
}

describe("rencanaMediaGanda: soal foto tunggal + sumber punya diagram -> dua gambar", () => {
  it("foto yang sudah tersimpan DIPERTAHANKAN (bukan alamat sumber), diagram ditambahkan di depan, keterangan ikut", () => {
    const baru = perbarui(kontekstual(), FOTO);
    const m = parseQuestionMedia(baru)!;
    expect(m.tipe).toBe("multi");
    expect(m.caption).toBe(KETERANGAN);
    expect(m.items.map((i) => [i.tipe, i.label])).toEqual([
      ["svg", "Diagram Presisi (SVG)"],
      ["foto", "Foto Ilustrasi"],
    ]);
    expect(m.items[0]!.svgContent).toBe(SVG);
    expect(m.items[1]!.url).toBe(FOTO);
    expect(baru).not.toContain("soal.ayotka.id/soal-images");
  });

  it("diagram disimpan sebagai markup saja (tanpa salinan data URI) supaya baris soal tidak membengkak", () => {
    const baru = perbarui(kontekstual(), FOTO);
    expect(baru).not.toContain("data:image/svg+xml");
    expect(baru.length).toBeLessThan(SVG.length + FOTO.length + KETERANGAN.length + 400);
  });

  it("DIRENDER untuk siswa: dua tab (Diagram dulu, lalu Foto), keterangan tampil, diagram sebagai gambar (bukan HTML mentah)", () => {
    const html = renderToStaticMarkup(createElement(MediaIlustrasi, { media: perbarui(kontekstual(), FOTO) }));
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/aria-selected="true"[^>]*>[^]*?Diagram Presisi \(SVG\)/);
    expect(html).toContain("Foto Ilustrasi");
    expect(html).toContain(KETERANGAN);
    expect(html).toContain('src="data:image/svg+xml;utf8,');
    expect(html).not.toContain('<circle cx="5"');
  });

  it("foto yang tersimpan sebagai JSON satu gambar (dengan keterangan lama) juga ditingkatkan, alamat fotonya tetap", () => {
    const lama = formatQuestionMedia({ tipe: "single", caption: "keterangan lama", items: [{ tipe: "foto", label: "Foto Ilustrasi", url: FOTO }] });
    const m = parseQuestionMedia(perbarui(kontekstual(), lama))!;
    expect(m.items).toHaveLength(2);
    expect(m.items[1]!.url).toBe(FOTO);
    expect(m.caption).toBe(KETERANGAN);
  });

  it("foto berupa data URI (cadangan saat unggah gagal) dipakai apa adanya", () => {
    const dataUri = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const m = parseQuestionMedia(perbarui(kontekstual(), dataUri))!;
    expect(m.items[1]!.url).toBe(dataUri);
  });

  it("keterangan kosong/spasi saja -> tanpa keterangan: null di JSON yang DISIMPAN (bukan string kosong atau spasi)", () => {
    for (const alt of ["", "   ", undefined]) {
      const baru = perbarui(kontekstual({ deskripsi_alt: alt as string }), FOTO);
      expect(JSON.parse(baru).caption, JSON.stringify(alt)).toBeNull();
      expect(parseQuestionMedia(baru)!.caption, JSON.stringify(alt)).toBeNull();
    }
  });

  it("keterangan dipangkas spasinya di JSON yang disimpan", () => {
    const baru = perbarui(kontekstual({ deskripsi_alt: `  ${KETERANGAN}  ` }), FOTO);
    expect(JSON.parse(baru).caption).toBe(KETERANGAN);
    expect(parseQuestionMedia(baru)!.caption).toBe(KETERANGAN);
  });
});

describe("rencanaMediaGanda: yang TIDAK diubah", () => {
  it("media yang sudah dua gambar tidak pernah diubah; hasil sendiri diulang = sudah_ganda (aman diulang)", () => {
    const ganda = perbarui(kontekstual(), FOTO);
    expect(rencanaMediaGanda(kontekstual(), ganda)).toEqual({ aksi: "lewati", alasan: "sudah_ganda" });
    // walau sumbernya berubah, yang sudah ganda dibiarkan
    expect(rencanaMediaGanda(kontekstual({ svg_fallback: SVG.replace("r=\"4\"", "r=\"3\"") }), ganda)).toEqual({ aksi: "lewati", alasan: "sudah_ganda" });
  });

  it("sumber hanya satu gambar: tipe svg, tipe url, tanpa gambar, ilustrasi kontekstual tanpa diagram cadangan", () => {
    const kasus: Array<[string, SourceGambar | null | undefined]> = [
      ["svg", { tipe: "svg", svg_content: SVG, deskripsi_alt: "x" }],
      ["url", { tipe: "url", url: "https://soal.ayotka.id/a.png", deskripsi_alt: "x" }],
      ["svg_fallback kosong", kontekstual({ svg_fallback: "" })],
      ["svg_fallback spasi", kontekstual({ svg_fallback: "   \n " })],
      ["svg_fallback tidak ada", kontekstual({ svg_fallback: undefined })],
      ["perlu_ilustrasi", { tipe: "perlu_ilustrasi", svg_fallback: SVG, deskripsi_alt: "x" }],
      ["null", null],
      ["undefined", undefined],
    ];
    for (const [nama, gambar] of kasus) {
      expect(rencanaMediaGanda(gambar, FOTO), nama).toEqual({ aksi: "lewati", alasan: "sumber_satu_gambar" });
    }
  });

  it("diagram di sumber rusak (aturan impor yang sama): tidak disalin", () => {
    const rusak = [
      `<svg xmlns="http://www.w3.org/2000/svg"><line x="1" y="2" x="3" y="4"/></svg>`, // atribut ganda
      "<div>bukan svg</div>",
      "teks biasa",
    ];
    for (const svg of rusak) {
      expect(rencanaMediaGanda(kontekstual({ svg_fallback: svg }), FOTO), svg).toEqual({ aksi: "lewati", alasan: "diagram_tidak_valid" });
    }
  });

  it("media sekarang bukan foto yang tersimpan: kosong, tidak terbaca, atau hanya diagram -> tidak ada foto untuk dipasangkan", () => {
    const hanyaDiagram = formatQuestionMedia({ tipe: "single", caption: null, items: [{ tipe: "svg", label: "Diagram Presisi (SVG)", svgContent: SVG }] });
    for (const media of [null, "", "   ", "bukan alamat gambar", "{rusak", "javascript:alert(1)", "data:image/svg+xml;utf8,%3Csvg%3E%3C%2Fsvg%3E", hanyaDiagram]) {
      expect(rencanaMediaGanda(kontekstual(), media), String(media)).toEqual({ aksi: "lewati", alasan: "tanpa_foto_tersimpan" });
    }
  });

  it("tidak mengubah argumennya", () => {
    const gambar = kontekstual();
    const salinan = JSON.stringify(gambar);
    perbarui(gambar, FOTO);
    expect(JSON.stringify(gambar)).toBe(salinan);
  });
});
