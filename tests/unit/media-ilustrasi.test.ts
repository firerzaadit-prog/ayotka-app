import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MediaIlustrasi } from "@/components/soal/media-ilustrasi";
import { formatQuestionMedia, type QuestionMediaData } from "@/lib/soal/media-types";

const FOTO = "https://cdn.test/foto.png";
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>`;

const render = (media: string | QuestionMediaData | null | undefined, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(MediaIlustrasi, { media, ...extra }));

const ganda = (caption: string | null = "Dua bangun datar"): QuestionMediaData => ({
  tipe: "multi",
  caption,
  items: [
    { tipe: "svg", label: "Diagram Presisi (SVG)", svgContent: SVG },
    { tipe: "foto", label: "Foto Ilustrasi", url: FOTO },
  ],
});

describe("MediaIlustrasi", () => {
  it("tidak menampilkan apa-apa untuk media kosong, JSON rusak, atau alamat berbahaya (bukan gambar rusak)", () => {
    for (const media of [null, undefined, "", "   ", "{rusak", "[1,2]", "javascript:alert(1)", JSON.stringify({ items: [{ tipe: "foto", url: "javascript:alert(1)" }] })]) {
      expect(render(media), String(media)).toBe("");
    }
  });

  it("satu alamat gambar (format lama): hanya <img>, tanpa tab dan tanpa keterangan", () => {
    const h = render(FOTO);
    expect(h).toContain(`src="${FOTO}"`);
    expect(h).not.toContain('role="tablist"');
    expect(h).not.toContain("Visualisasi / Diagram Pendukung");
  });

  it("satu gambar dengan keterangan (JSON): keterangan tampil, tab tidak", () => {
    const h = render(formatQuestionMedia({ tipe: "single", caption: "Grafik batang penjualan", items: [{ tipe: "foto", label: "Foto Ilustrasi", url: FOTO }] }));
    expect(h).toContain("Visualisasi / Diagram Pendukung");
    expect(h).toContain("Grafik batang penjualan");
    expect(h).not.toContain('role="tablist"');
    expect(h).toContain(`src="${FOTO}"`);
  });

  it("media ganda: tab Diagram dan Foto, tab awal = foto, keterangan tampil", () => {
    const h = render(JSON.stringify(ganda()));
    expect(h).toContain('role="tablist"');
    expect(h).toContain("Diagram Presisi (SVG)");
    expect(h).toContain("Foto Ilustrasi");
    expect(h).toContain("Dua bangun datar");
    expect(h).toContain(`src="${FOTO}"`);
    expect(h).toMatch(/aria-selected="true"[^>]*>[^]*?Foto Ilustrasi/);
  });

  it("defaultTab=svg membuka diagram lebih dulu; SVG dibungkus data URI (tidak pernah HTML mentah)", () => {
    const h = render(JSON.stringify(ganda()), { defaultTab: "svg" });
    expect(h).toContain(`src="data:image/svg+xml;utf8,${encodeURIComponent(SVG).replace(/&/g, "&amp;")}"`);
    // Isi SVG sumber tidak boleh muncul sebagai markup (ikon <svg> milik antarmuka sendiri tidak dihitung).
    expect(h).not.toContain('<circle cx="5"');
    expect(h).not.toContain(`src="${FOTO}"`);
  });

  it("menerima objek QuestionMediaData langsung (pratinjau impor)", () => {
    const h = render(ganda(null));
    expect(h).toContain('role="tablist"');
    expect(h).not.toContain("Visualisasi / Diagram Pendukung");
  });

  it("keterangan dari sumber tidak diloloskan sebagai HTML", () => {
    const h = render(formatQuestionMedia({ tipe: "single", caption: '<img src=x onerror="alert(1)"><script>alert(2)</script>', items: [{ tipe: "foto", label: "F", url: FOTO }] }));
    expect(h).not.toContain("<script>");
    expect(h).not.toContain('onerror="alert(1)"><');
    expect(h).toContain("&lt;script&gt;");
  });

  it("item tanpa sumber dibuang; sisanya tetap tampil tanpa tab", () => {
    const h = render(JSON.stringify({ items: [{ tipe: "svg" }, { tipe: "foto", url: FOTO }] }));
    expect(h).toContain(`src="${FOTO}"`);
    expect(h).not.toContain('role="tablist"');
  });

  it("className diteruskan ke pembungkus", () => {
    expect(render(FOTO, { className: "mb-5" })).toMatch(/class="[^"]*mb-5/);
  });
});
