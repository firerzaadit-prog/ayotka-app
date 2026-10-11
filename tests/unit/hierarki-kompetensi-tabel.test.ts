import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HierarkiKompetensiTabel } from "@/components/hasil/hierarki-kompetensi-tabel";
import { bangunHierarkiKompetensi, type BarisHierarkiKompetensi } from "@/lib/exam/hierarki-kompetensi";
import { urutanHierarkiResmi } from "@/lib/indikator/hierarki-resmi";

const html = (baris: BarisHierarkiKompetensi[]) => renderToStaticMarkup(createElement(HierarkiKompetensiTabel, { baris }));
const teks = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const contoh = bangunHierarkiKompetensi(
  [
    { kompetensiId: "k1", elemenId: "e1", elemenNama: "Aljabar", elemenUrutan: 1, subElemen: "Bentuk Aljabar", kompetensi: "Menghitung operasi aljabar", level: "L1", jmlBenar: 1, jmlSoal: 2 },
    { kompetensiId: "k2", elemenId: "e1", elemenNama: "Aljabar", elemenUrutan: 1, subElemen: "Bentuk Aljabar", kompetensi: "Mengaplikasikan sifat operasi", level: "L2", jmlBenar: 4, jmlSoal: 4 },
    { kompetensiId: "k3", elemenId: "e1", elemenNama: "Aljabar", elemenUrutan: 1, subElemen: "Barisan dan Deret", kompetensi: "Menghitung suku ke-n", level: "L1", jmlBenar: 0, jmlSoal: 2 },
    { kompetensiId: "k4", elemenId: "e2", elemenNama: "Bilangan", elemenUrutan: 2, subElemen: "Bilangan Real", kompetensi: "Menghitung hasil operasi", level: "L1", jmlBenar: 0, jmlSoal: 0 },
  ],
  urutanHierarkiResmi("SMP", "Matematika"),
);

describe("HierarkiKompetensiTabel (Peta Kompetensi bentuk hierarki di rapor siswa)", () => {
  it("kepala tabel seperti tabel hierarki Analitik: Hierarki dan Skor kamu (hanya dua kolom, kartu rapor sempit)", () => {
    const h = html(contoh);
    expect(teks(h)).toContain("Hierarki");
    expect(teks(h)).toContain("Skor kamu");
    expect([...h.matchAll(/<th /g)]).toHaveLength(2);
    expect(h).toContain('scope="col"');
  });

  it("menampilkan tiga tingkat dengan penanda: '1. Bilangan', '› Subelemen', '› Kompetensi'", () => {
    const t = teks(html(contoh));
    expect(t).toContain("1. Bilangan");
    expect(t).toContain("2. Aljabar");
    expect(t).toContain("› Bentuk Aljabar");
    expect(t).toContain("› Menghitung operasi aljabar");
    const h = html(contoh);
    expect([...h.matchAll(/data-level="1"/g)]).toHaveLength(2);
    expect([...h.matchAll(/data-level="2"/g)]).toHaveLength(3);
    expect([...h.matchAll(/data-level="3"/g)]).toHaveLength(4);
  });

  it("urutan baris mengikuti hierarki: Bilangan (resmi #1) lebih dulu dari Aljabar, subelemen resmi berurutan", () => {
    const t = teks(html(contoh));
    expect(t.indexOf("1. Bilangan")).toBeLessThan(t.indexOf("2. Aljabar"));
    expect(t.indexOf("› Bentuk Aljabar")).toBeLessThan(t.indexOf("› Barisan dan Deret"));
  });

  it("skor memakai lencana berwarna dengan ambang yang sama dengan grafik lama; benar/soal ditampilkan", () => {
    const h = html(contoh);
    // Aljabar: 5/8 = 62,5% -> 63% (cukup, kuning); Bentuk Aljabar 5/6 = 83% (baik, hijau); Barisan 0/2 = 0% (perlu latihan, merah)
    expect(h).toMatch(/text-amber-700[^>]*>63%</);
    expect(h).toMatch(/text-emerald-700[^>]*>83%</);
    expect(h).toMatch(/text-rose-700[^>]*>0%</);
    const t = teks(h);
    expect(t).toContain("5/8 benar");
    expect(t).toContain("5/6 benar");
    expect(t).toContain("0/2 benar");
  });

  it("simpul tanpa soal tampil strip tanpa keterangan jumlah, bukan NaN atau 0%", () => {
    const h = html(contoh);
    const barisBilangan = h.split("<tr").filter((r) => r.includes("Menghitung hasil operasi"))[0]!;
    expect(teks(barisBilangan)).toContain("–");
    expect(teks(barisBilangan)).not.toContain("benar");
    expect(h).not.toContain("NaN");
  });

  it("keterangan warna ada (Baik/Cukup/Perlu latihan)", () => {
    const h = html(contoh);
    expect(h).toContain("Baik (≥70%)");
    expect(h).toContain("Cukup (50-69%)");
    expect(h).toContain("Perlu latihan (&lt;50%)");
  });

  it("teks dari database tidak diloloskan sebagai HTML", () => {
    const h = html(
      bangunHierarkiKompetensi([
        { kompetensiId: "x", elemenId: "ex", elemenNama: "<script>alert(1)</script>", elemenUrutan: 1, subElemen: "<b>sub</b>", kompetensi: "<img src=x onerror=alert(2)>", level: "L1", jmlBenar: 1, jmlSoal: 1 },
      ]),
    );
    expect(h).not.toContain("<script>");
    expect(h).not.toContain("<b>sub</b>");
    expect(h).not.toContain("<img");
    expect(h).toContain("&lt;script&gt;");
  });

  it("data kosong tidak membuat galat", () => {
    expect(() => html([])).not.toThrow();
  });
});
