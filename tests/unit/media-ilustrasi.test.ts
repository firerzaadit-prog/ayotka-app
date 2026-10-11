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

  it("media ganda: tab Diagram dan Foto, tab awal = DIAGRAM (seperti di soal.ayotka.id), keterangan tampil", () => {
    const h = render(JSON.stringify(ganda()));
    expect(h).toContain('role="tablist"');
    expect(h).toContain("Diagram Presisi (SVG)");
    expect(h).toContain("Foto Ilustrasi");
    expect(h).toContain("Dua bangun datar");
    // yang tampil = diagram (data URI), bukan foto
    expect(h).toContain(`src="data:image/svg+xml;utf8,${encodeURIComponent(SVG).replace(/&/g, "&amp;")}"`);
    expect(h).not.toContain(`src="${FOTO}"`);
    // tab Diagram terpilih, tab Foto tidak
    expect(h).toMatch(/aria-selected="true"[^>]*>[^]*?Diagram Presisi \(SVG\)/);
    expect(h).toMatch(/aria-selected="false"[^>]*>[^]*?Foto Ilustrasi/);
    expect([...h.matchAll(/aria-selected="true"/g)]).toHaveLength(1);
  });

  it("SVG dibungkus data URI (tidak pernah HTML mentah)", () => {
    const h = render(JSON.stringify(ganda()));
    // Isi SVG sumber tidak boleh muncul sebagai markup (ikon <svg> milik antarmuka sendiri tidak dihitung).
    expect(h).not.toContain('<circle cx="5"');
  });

  it("defaultTab=foto membuka foto lebih dulu", () => {
    const h = render(JSON.stringify(ganda()), { defaultTab: "foto" });
    expect(h).toContain(`src="${FOTO}"`);
    expect(h).not.toContain("data:image/svg+xml");
    expect(h).toMatch(/aria-selected="false"[^>]*>[^]*?Diagram Presisi \(SVG\)/);
    expect(h).toMatch(/aria-selected="true"[^>]*>[^]*?Foto Ilustrasi/);
  });

  it("tab awal yang diminta tidak ada di soal: jatuh ke gambar pertama (tidak kosong)", () => {
    const duaFoto = JSON.stringify({ items: [{ tipe: "foto", label: "Foto A", url: FOTO }, { tipe: "foto", label: "Foto B", url: "https://cdn.test/b.png" }] });
    const h = render(duaFoto, { defaultTab: "svg" });
    expect(h).toContain(`src="${FOTO}"`);
    expect(h).toMatch(/aria-selected="true"[^>]*>[^]*?Foto A/);
  });

  // Susunan mengikuti soal.ayotka.id: judul di kiri + keterangan miring di kanan, lalu SATU bingkai yang memuat
  // "Tampilan Ilustrasi:" + tab di bagian atas dan gambar di bawahnya.
  it("susunan seperti soal.ayotka.id: judul+keterangan, lalu bingkai berisi pemilih tampilan lalu gambar", () => {
    const h = render(JSON.stringify(ganda()));
    const iJudul = h.indexOf("Visualisasi / Diagram Pendukung");
    const iKeterangan = h.indexOf("Dua bangun datar");
    const iBingkai = h.indexOf("rounded-2xl");
    const iPemilih = h.indexOf("Tampilan Ilustrasi:");
    const iTab = h.indexOf('role="tablist"');
    const iGambar = h.indexOf("<img");
    for (const [nama, i] of Object.entries({ iJudul, iKeterangan, iBingkai, iPemilih, iTab, iGambar })) expect(i, nama).toBeGreaterThan(-1);
    expect(iJudul).toBeLessThan(iKeterangan);
    expect(iKeterangan).toBeLessThan(iBingkai);
    // pemilih tampilan dan tab ada DI DALAM bingkai, di atas gambar
    expect(iBingkai).toBeLessThan(iPemilih);
    expect(iPemilih).toBeLessThan(iTab);
    expect(iTab).toBeLessThan(iGambar);
    // judul dan keterangan satu baris di layar lebar, bertumpuk di HP
    expect(h).toMatch(/class="flex flex-col gap-1 sm:flex-row[^"]*"><div[^>]*>[^]*?Visualisasi \/ Diagram Pendukung/);
    // keterangan miring
    expect(h).toMatch(/<p class="[^"]*\bitalic\b[^"]*">Dua bangun datar<\/p>/);
  });

  it("satu gambar dengan keterangan: bingkai tanpa pemilih tampilan", () => {
    const h = render(formatQuestionMedia({ tipe: "single", caption: "Grafik batang", items: [{ tipe: "foto", label: "Foto Ilustrasi", url: FOTO }] }));
    expect(h).toContain("rounded-2xl");
    expect(h).not.toContain("Tampilan Ilustrasi:");
    expect(h).not.toContain('role="tablist"');
  });

  it("tab diberi ikon seperti di soal.ayotka.id: diagram 📊, foto 📷", () => {
    const h = render(JSON.stringify(ganda()));
    expect(h).toMatch(/📊<\/span><span>Diagram Presisi \(SVG\)<\/span>/);
    expect(h).toMatch(/📷<\/span><span>Foto Ilustrasi<\/span>/);
  });

  it("media ganda tanpa keterangan: pemilih tampilan ada, judul/keterangan tidak", () => {
    const h = render(ganda(null));
    expect(h).toContain("Tampilan Ilustrasi:");
    expect(h).not.toContain("Visualisasi / Diagram Pendukung");
  });

  it("tab cukup besar untuk jari di HP dan labelnya boleh membungkus (tidak melebihi lebar layar)", () => {
    const h = render(JSON.stringify(ganda()));
    const tabs = [...h.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((m) => m[0]);
    expect(tabs).toHaveLength(2);
    for (const t of tabs) {
      expect(t).toContain("py-1.5");
      expect(t).toContain("min-w-0");
    }
    // di HP: dua kolom sama lebar selebar bingkai; di layar lebar: ringkas selebar isinya
    const tablist = h.match(/<div role="tablist"[^>]*>/)?.[0] ?? "";
    for (const kelas of ["grid", "w-full", "grid-cols-2", "sm:inline-flex", "sm:w-auto"]) expect(tablist, kelas).toMatch(new RegExp(`[\\s"]${kelas}[\\s"]`));
    expect(h).toContain("flex-wrap");
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
