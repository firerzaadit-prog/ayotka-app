import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MediaIlustrasi } from "@/components/soal/media-ilustrasi";
import { formatQuestionMedia, mediaTanpaKeterangan, parseQuestionMedia, type QuestionMediaData } from "@/lib/soal/media-types";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>`;
const FOTO = "https://ayotka.id/media/soal-media/abc.jpg";
// Contoh nyata: keterangan yang menyebut kunci jawaban soalnya.
const KETERANGAN = "Dua bangun datar segiempat: Bangun (1) berupa belah ketupat dengan kedua diagonal berpotongan tegak lurus di tengah.";

const ganda = (extra: Partial<QuestionMediaData> = {}): string =>
  formatQuestionMedia({
    tipe: "multi",
    caption: KETERANGAN,
    items: [
      { tipe: "svg", label: "Diagram Presisi (SVG)", svgContent: SVG, alt: KETERANGAN },
      { tipe: "foto", label: "Foto Ilustrasi", url: FOTO, alt: KETERANGAN },
    ],
    ...extra,
  });

describe("mediaTanpaKeterangan (media yang dikirim ke siswa)", () => {
  it("dua gambar: keterangan DAN teks alternatif turunannya hilang dari seluruh string, gambar + label utuh", () => {
    const hasil = mediaTanpaKeterangan(ganda())!;
    expect(hasil).not.toContain("diagonal");
    expect(hasil).not.toContain("tegak lurus");
    expect(hasil).not.toContain("belah ketupat");
    const m = parseQuestionMedia(hasil)!;
    expect(m.caption).toBeNull();
    expect(m.tipe).toBe("multi");
    expect(m.items.map((i) => [i.tipe, i.label])).toEqual([
      ["svg", "Diagram Presisi (SVG)"],
      ["foto", "Foto Ilustrasi"],
    ]);
    expect(m.items[0]!.svgContent).toBe(SVG);
    expect(m.items[1]!.url).toBe(FOTO);
    expect(m.items.every((i) => i.alt === undefined)).toBe(true);
  });

  it("DIRENDER untuk siswa: dua tab tetap ada (Diagram dulu), tetapi tanpa judul/keterangan 'Visualisasi / Diagram Pendukung'", () => {
    const html = renderToStaticMarkup(createElement(MediaIlustrasi, { media: mediaTanpaKeterangan(ganda()) }));
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/aria-selected="true"[^>]*>[^]*?Diagram Presisi \(SVG\)/);
    expect(html).toContain("Foto Ilustrasi");
    expect(html).not.toContain("Visualisasi / Diagram Pendukung");
    expect(html).not.toContain("tegak lurus");
    // teks alternatif gambar pun bukan keterangan (hanya label tab)
    expect(html).toMatch(/alt="Diagram Presisi \(SVG\)"/);
  });

  it("untuk perbandingan: media ASLI (admin) tetap menampilkan keterangan", () => {
    const html = renderToStaticMarkup(createElement(MediaIlustrasi, { media: ganda() }));
    expect(html).toContain("Visualisasi / Diagram Pendukung");
    expect(html).toContain("tegak lurus");
  });

  it("satu foto + keterangan (JSON) kembali menjadi alamat gambar polos seperti format lama", () => {
    const satu = formatQuestionMedia({ tipe: "single", caption: KETERANGAN, items: [{ tipe: "foto", label: "Foto Ilustrasi", url: FOTO, alt: KETERANGAN }] });
    expect(satu.startsWith("{")).toBe(true);
    expect(mediaTanpaKeterangan(satu)).toBe(FOTO);
  });

  it("satu diagram (hanya markup SVG) + keterangan tetap JSON (diagram tidak punya alamat), tanpa keterangan", () => {
    const satu = formatQuestionMedia({ tipe: "single", caption: KETERANGAN, items: [{ tipe: "svg", label: "Diagram Presisi (SVG)", svgContent: SVG }] });
    const hasil = mediaTanpaKeterangan(satu)!;
    expect(hasil).not.toContain("tegak lurus");
    const m = parseQuestionMedia(hasil)!;
    expect(m.items).toHaveLength(1);
    expect(m.items[0]!.svgContent).toBe(SVG);
    expect(m.caption).toBeNull();
  });

  it("yang bukan JSON (alamat gambar polos, data URI, teks lain), kosong, dan null dikembalikan apa adanya", () => {
    for (const nilai of [FOTO, "/media/soal-media/a.png", "data:image/jpeg;base64,/9j/4AAQ", "bukan alamat gambar", "", null, undefined]) {
      expect(mediaTanpaKeterangan(nilai), String(nilai)).toBe(nilai);
    }
  });

  it("JSON yang tidak bisa dibaca / bukan media / berbahaya menjadi null (memang tidak tampil), bukan diteruskan mentah", () => {
    for (const rusak of ["{rusak", "{}", '{"items":[]}', '{"items":[{"tipe":"foto","url":"javascript:alert(1)"}]}', `{"caption":"${KETERANGAN}","items":"bukan larik"}`]) {
      expect(mediaTanpaKeterangan(rusak), rusak).toBeNull();
    }
  });

  it("idempoten dan tidak mengubah masukan", () => {
    const awal = ganda();
    const salinan = String(awal);
    const sekali = mediaTanpaKeterangan(awal)!;
    expect(awal).toBe(salinan);
    expect(mediaTanpaKeterangan(sekali)).toBe(sekali);
  });

  it("media ganda tanpa keterangan sejak awal tidak berubah artinya", () => {
    const awal = ganda({ caption: null });
    const hasil = parseQuestionMedia(mediaTanpaKeterangan(awal))!;
    expect(hasil.items).toHaveLength(2);
    expect(hasil.caption).toBeNull();
  });
});
