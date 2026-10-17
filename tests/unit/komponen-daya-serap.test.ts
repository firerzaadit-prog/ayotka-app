import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarisUraian, DayaSerapIndikator, ringkasanSoal } from "@/components/hasil/daya-serap-indikator";
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
    // rujukan nasional dan selisih kini di kolom/baris yang sama dengan skornya (tidak ada tabel ringkasan terpisah)
    expect(h).toContain("30,0%");
    expect(h).toContain("+70,0 poin");
    expect(h).toContain("-55,0 poin");
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

/** Baris tabel pada tingkat hierarki tertentu (data-level). */
const barisTingkat = (isi: string, tingkat: number) =>
  [...isi.matchAll(new RegExp(`<tr [^>]*data-level="${tingkat}"[^>]*>[\\s\\S]*?</tr>`, "g"))].map((m) => m[0]);

describe("ringkasanSoal (keterangan jumlah soal di bawah skor)", () => {
  it.each<[string, { jmlSoal?: number; skor?: number; skorMaks?: number }, string | null]>([
    ["bobot sama: skor = jumlah benar", { jmlSoal: 12, skor: 10, skorMaks: 12 }, "10/12 benar"],
    ["semua benar", { jmlSoal: 3, skor: 3, skorMaks: 3 }, "3/3 benar"],
    ["semua salah", { jmlSoal: 2, skor: 0, skorMaks: 2 }, "0/2 benar"],
    ["bobot berbeda: jumlah benar tak bisa diturunkan, cukup jumlah soal", { jmlSoal: 3, skor: 3, skorMaks: 4 }, "3 soal"],
    ["skor pecahan: tidak mengaku 'benar'", { jmlSoal: 2, skor: 1.5, skorMaks: 2 }, "2 soal"],
    ["tanpa skor (indikator resmi yang belum diuji)", { jmlSoal: 2 }, "2 soal"],
    ["tanpa soal: tidak ada keterangan", { jmlSoal: 0, skor: 0, skorMaks: 0 }, null],
    ["jumlah soal tidak ada: tidak ada keterangan", {}, null],
  ])("%s", (_nama, row, harapan) => {
    expect(ringkasanSoal(row)).toBe(harapan);
  });
});

// Permintaan user (17 Okt 2026): Peta Kompetensi, Ringkasan Capaian per Elemen, Tabel Hierarki, dan Tampilan Akordion
// dijadikan SATU tabel supaya siswa mudah membacanya. Semua informasi lama harus tetap ada di tabel itu.
describe("satu tabel capaian (hierarki + skor + rujukan nasional + selisih)", () => {
  const jawaban = () => [...ulang(mat(1, { nilaiNasional: 30 }), 4, 4), ...ulang(mat(3, { nilaiNasional: 80 }), 4, 1)];
  const h = () => html(jawaban());

  it("hanya ada satu tabel dan tidak ada lagi tabel ringkasan, akordion, atau pengalih tampilan", () => {
    const isi = h();
    expect(isi.match(/<table/g)).toHaveLength(1);
    expect(isi).not.toContain("Ringkasan Capaian per");
    expect(isi).not.toContain("Tampilan Akordion");
    expect(isi).not.toContain("Tabel Hierarki Resmi");
    expect(isi).not.toContain("Tabel Hierarki Daya Serap Kemendikdasmen");
    expect(isi).not.toContain("STATUS CAPAIAN");
  });

  it("tiga kolom: Hierarki, Skor kamu, Rujukan nasional; selisih ditumpuk di bawah angka nasional (bukan kolom sendiri)", () => {
    const kepala = h().match(/<thead>[\s\S]*?<\/thead>/)![0];
    const kolom = [...kepala.matchAll(/<th [^>]*>([^<]*)<\/th>/g)].map((m) => m[1]!.trim());
    expect(kolom).toEqual(["Hierarki", "Skor kamu", "Rujukan nasional"]);
  });

  it("baris Elemen membawa status dibanding rerata nasional, skor, jumlah soal, dan selisihnya", () => {
    const [bilangan, aljabar] = barisTingkat(h(), 1);
    expect(bilangan).toContain("Bilangan");
    expect(bilangan).toContain("Di atas rerata nasional");
    expect(bilangan).toContain("100,0%");
    expect(bilangan).toContain("4/4 benar");
    expect(bilangan).toContain("+70,0 poin");
    expect(aljabar).toContain("Aljabar");
    expect(aljabar).toContain("Perlu penguatan");
    expect(aljabar).toContain("1/4 benar");
    expect(aljabar).toContain("-55,0 poin");
  });

  it("jumlah benar tampil di semua tingkat seperti Peta Kompetensi lama (x/y benar), termasuk baris indikator", () => {
    const isi = html([...ulang(mat(1), 5, 3), ...ulang(mat(2), 2, 2)]);
    expect(barisTingkat(isi, 1)[0]).toContain("5/7 benar");
    expect(barisTingkat(isi, 2)[0]).toContain("5/7 benar");
    expect(isi).toContain("3/5 benar");
    expect(isi).toContain("2/2 benar");
  });

  it("selisih baris Elemen = selisih resmi kelompok (hanya indikator yang punya pembanding), bukan skor dikurang nasional kasar", () => {
    // mat(1) punya pembanding 40 dan dijawab benar semua; mat(2) tanpa pembanding dan salah semua. Skor kelompok Bilangan
    // 50%, nasional 40%: hitungan kasar "skor - nasional" = +10,0 poin, tetapi selisih resmi hanya pada indikator yang
    // punya pembanding (100% - 40% = +60,0 poin). Tabel ringkasan lama memakai angka resmi; baris Elemen juga.
    const laporan = hitungLaporanSiswa([...ulang(mat(1, { nilaiNasional: 40 }), 3, 3), ...ulang(mat(2, { nilaiNasional: null }), 3, 0)])!;
    expect(laporan.kelompok[0]!.dayaSerap).toBeCloseTo(50);
    expect(laporan.kelompok[0]!.selisih).toBeCloseTo(60);
    const [bilangan] = barisTingkat(renderToStaticMarkup(createElement(DayaSerapIndikator, { laporan })), 1);
    expect(bilangan).toContain("+60,0 poin");
    expect(bilangan).not.toContain("+10,0 poin");
  });

  it("HP: rujukan nasional dan selisih ikut tampil di bawah skor (kolom ketiga hanya mulai layar sm)", () => {
    const [bilangan] = barisTingkat(h(), 1);
    expect(bilangan).toMatch(/sm:hidden[^>]*>Nasional 30,0%/);
    expect(h()).toContain("sm:table-cell");
  });

  it("Elemen dengan soal terlalu sedikit: tidak dibandingkan (tanpa angka nasional dan selisih), dengan penjelasannya", () => {
    const [bilangan] = barisTingkat(html([...ulang(mat(1), 2, 2)]), 1);
    expect(bilangan).toContain("Data belum cukup");
    expect(bilangan).toContain("Baru 2 soal; butuh minimal 3 soal untuk dibandingkan.");
    expect(bilangan).not.toContain("poin");
    expect(bilangan).not.toMatch(/Nasional \d/);
  });

  it("Bahasa Indonesia: tiga tingkat, tetap satu tabel, tanpa kata Elemen/Subelemen", () => {
    const isi = html([...ulang(bin(1), 4, 4), ...ulang(bin(2), 4, 1)]);
    expect(isi.match(/<table/g)).toHaveLength(1);
    expect(barisTingkat(isi, 1).length).toBeGreaterThan(0);
    expect(barisTingkat(isi, 4)).toHaveLength(0);
    expect(isi).not.toMatch(/Elemen|Subelemen/);
  });

  it("filter 'Hanya yang Diuji' dan 'Semua Indikator Resmi' ada dan menyebut jumlahnya", () => {
    const isi = h();
    expect(isi).toMatch(/aria-pressed="true"[^>]*>Hanya yang Diuji \(2\)</);
    expect(isi).toMatch(/aria-pressed="false"[^>]*>Semua Indikator Resmi \(\d+\)</);
  });

  it("legenda warna ada di bawah tabel", () => {
    const isi = h();
    expect(isi).toContain("Baik (≥70%)");
    expect(isi).toContain("Cukup (50-69%)");
    expect(isi).toContain("Perlu latihan (&lt;50%)");
  });

  it("kalimat sumber rujukan nasional hanya sekali (tidak diulang di bawah tiap bagian)", () => {
    const isi = h();
    expect(isi.split("Rujukan nasional berdasarkan data hasil TKA tahun ajaran 2025/2026.").length - 1).toBe(1);
    expect(isi.match(/data-catatan-rujukan-nasional/g)).toHaveLength(1);
    expect(isi.indexOf("data-catatan-rujukan-nasional")).toBeGreaterThan(isi.indexOf("</table>"));
  });
});

describe("Prioritas belajar & Kekuatanmu = fitur berbayar (tampilkanFokus)", () => {
  const jawaban = () => [...ulang(mat(1, { nilaiNasional: 30 }), 4, 4), ...ulang(mat(3, { nilaiNasional: 80 }), 4, 1)];
  const render = (tampilkanFokus?: boolean) =>
    renderToStaticMarkup(createElement(DayaSerapIndikator, { laporan: hitungLaporanSiswa(jawaban())!, tampilkanFokus }));

  it("bawaan dan true: kedua kartu tampil", () => {
    for (const h of [render(), render(true)]) {
      expect(h).toContain("data-kartu-fokus");
      expect(h).toContain("Prioritas belajar");
      expect(h).toContain("Kekuatanmu");
    }
  });

  it("false: kedua kartu hilang sama sekali (judul, deskripsi, dan pesan kosongnya)", () => {
    const h = render(false);
    expect(h).not.toContain("data-kartu-fokus");
    expect(h).not.toContain("Prioritas belajar");
    expect(h).not.toContain("Kekuatanmu");
    expect(h).not.toContain("mulai remedial dari sini");
    expect(h).not.toContain("Semua indikator sudah dikuasai penuh.");
    expect(h).not.toContain("Belum ada indikator yang menonjol.");
  });

  it("false: bagian lain laporan tetap utuh (tabel hierarki, rerata nasional, catatan sumber)", () => {
    const h = render(false);
    expect(h).toContain("data-tabel-capaian");
    expect(h).toContain("Indikator mat 1 (1)");
    expect(h).toContain("nasional 80,0%");
    expect(h).toContain("Rujukan nasional berdasarkan data hasil TKA tahun ajaran 2025/2026.");
  });
});

describe("nomor urut indikator resmi tidak ditampilkan (terbaca seperti nomor soal)", () => {
  it("tampilan bawaan (tabel hierarki + kartu fokus): tidak ada lencana #n atau 'Kode Indikator Resmi', kalimat indikator tetap tampil", () => {
    const h = html([...ulang(mat(1), 4, 4), ...ulang(mat(2), 3, 1), ...ulang(mat(3), 2, 2), ...ulang(mat(4), 2, 0)]);
    expect(h).not.toMatch(/>\s*#\d+\s*</);
    expect(h).not.toContain("Kode Indikator Resmi");
    expect(h).toContain("Indikator mat 1");
    expect(h).toContain("Prioritas belajar");
  });

  it("kartu baris (akordion dan laporan sekolah): tidak ada lencana, nomor di ujung kalimat dibuang dari teks yang terlihat", () => {
    const b = {
      indikatorId: "i1",
      level1: "Bilangan",
      level2: "Bilangan Real",
      level3: "Kemampuan X",
      indikator: "Menyelesaikan operasi bilangan bentuk pangkat (13)",
      urutan: 13,
      jmlSoal: 5,
      skor: 4,
      skorMaks: 5,
      dayaSerap: 80,
      nasional: 34.1,
    };
    const h = renderToStaticMarkup(createElement("ul", null, createElement(BarisUraian, { b })));
    expect(h).not.toMatch(/>\s*#\d+\s*</);
    expect(h).not.toContain("Kode Indikator Resmi");
    // teks yang terlihat tidak memuat "(13)"; nomor aslinya hanya ada di teks bantu pembaca layar dan tooltip
    const terlihat = h.replace(/<span class="sr-only">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, " ");
    expect(terlihat).toContain("Menyelesaikan operasi bilangan bentuk pangkat");
    expect(terlihat).not.toContain("(13)");
    expect(terlihat).toContain("5 soal");
    expect(terlihat).toContain("nasional 34,1%");
  });
});
