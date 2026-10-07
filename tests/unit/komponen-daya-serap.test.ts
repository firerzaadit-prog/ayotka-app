import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DayaSerapIndikator } from "@/components/hasil/daya-serap-indikator";
import { hitungLaporanSiswa, type InfoIndikator, type JawabanBerindikator } from "@/lib/indikator/daya-serap";

const mat = (n: number, o: Partial<InfoIndikator> = {}): InfoIndikator => ({
  id: `m${n}`,
  jenjang: "SMP",
  namaMapel: "Matematika",
  elemen: n <= 2 ? "Bilangan" : "Aljabar",
  subelemen: n <= 2 ? "Bilangan Real" : "Persamaan",
  kompetensi: `Kemampuan nomor ${n}`,
  indikator: `Indikator mat ${n} (${n})`,
  urutan: n,
  nilaiNasional: 40,
  ...o,
});
const bin = (n: number): InfoIndikator => ({
  id: `b${n}`,
  jenjang: "SMP",
  namaMapel: "Bahasa Indonesia",
  elemen: "Pemahaman Tekstual",
  subelemen: `Subkompetensi ${n}`,
  kompetensi: `Subkompetensi ${n}`,
  indikator: `Indikator bin ${n} (${n})`,
  urutan: n,
  nilaiNasional: 55,
});
const jw = (ind: InfoIndikator | null, skor: number): JawabanBerindikator => ({ indikator: ind, skor, skorMaks: 1 });
const ulang = (ind: InfoIndikator, n: number, benar: number) => Array.from({ length: n }, (_, i) => jw(ind, i < benar ? 1 : 0));

const html = (jawaban: JawabanBerindikator[]) => renderToStaticMarkup(createElement(DayaSerapIndikator, { laporan: hitungLaporanSiswa(jawaban)! }));

describe("komponen DayaSerapIndikator (rapor siswa di web)", () => {
  it("Matematika: label 4 tingkat, nama kelompok, persen, rerata nasional, dan vonis tampil", () => {
    const h = html([...ulang(mat(1, { nilaiNasional: 30 }), 4, 4), ...ulang(mat(3, { nilaiNasional: 80 }), 4, 1)]);
    expect(h).toContain("Elemen → Subelemen → Kompetensi → Indikator");
    expect(h).toContain("Bilangan");
    expect(h).toContain("Aljabar");
    expect(h).toContain("Di atas rerata nasional");
    expect(h).toContain("Perlu penguatan");
    expect(h).toContain("Rerata nasional 30,0%");
    expect(h).toContain("nasional 80,0%");
    expect(h).toContain("Indikator mat 1 (1)");
    expect(h).toContain("Prioritas belajar");
    expect(h).toContain("Kekuatanmu");
  });

  it("Bahasa Indonesia: 3 tingkat dan tidak ada kata Elemen/Subelemen di HTML sama sekali", () => {
    const h = html([...ulang(bin(1), 4, 4), ...ulang(bin(2), 4, 1)]);
    expect(h).toContain("Kompetensi → Subkompetensi → Indikator");
    expect(h).toContain("Pemahaman Tekstual");
    expect(h).not.toMatch(/Elemen|Subelemen/);
  });

  it("kelompok dengan sedikit soal: 'Data belum cukup' dan penjelasan minimal 3 soal, tanpa angka selisih", () => {
    const h = html([...ulang(mat(1), 2, 2)]);
    expect(h).toContain("Data belum cukup");
    expect(h).toContain("butuh minimal 3 soal untuk dibandingkan");
    expect(h).not.toContain("poin)");
  });

  it("tanpa rerata nasional: 'Tanpa pembanding nasional', tidak menampilkan 'nasional' di baris", () => {
    const h = html(ulang(mat(1, { nilaiNasional: null }), 4, 2));
    expect(h).toContain("Tanpa pembanding nasional");
    expect(h).not.toMatch(/nasional \d/);
  });

  it("cakupan sebagian: menyebut berapa soal yang dihitung dari seluruh soal", () => {
    const h = html([...ulang(mat(1), 3, 3), jw(null, 1), jw(null, 0)]);
    expect(h).toContain("3 dari 5 soal pada percobaan ini memiliki indikator resmi");
  });

  it("seluruh soal berindikator: kalimat cakupan penuh", () => {
    const h = html(ulang(mat(1), 4, 2));
    expect(h).toContain("Seluruh 4 soal pada percobaan ini dihitung berdasarkan indikator resmi");
  });

  it("semua indikator dikuasai penuh: pesan khusus di daftar prioritas belajar, bukan daftar kosong", () => {
    const h = html([...ulang(mat(1), 3, 3), ...ulang(mat(3), 3, 3)]);
    expect(h).toContain("Semua indikator sudah dikuasai penuh.");
  });

  it("teks indikator tidak diloloskan sebagai HTML (aman dari injeksi dari data master)", () => {
    const h = html(ulang(mat(1, { indikator: "<img src=x onerror=alert(1)> (1)" }), 4, 2));
    expect(h).not.toContain("<img");
    expect(h).toContain("&lt;img");
  });

  it("warna batang mengikuti tier yang sama dengan Peta Kompetensi", () => {
    const h = html([...ulang(mat(1), 10, 9), ...ulang(mat(3), 10, 5), ...ulang(mat(4), 10, 1)]);
    expect(h).toContain("bg-emerald-600");
    expect(h).toContain("bg-amber-600");
    expect(h).toContain("bg-rose-600");
  });
});
