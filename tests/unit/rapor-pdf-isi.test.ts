import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ANALISIS_CONTOH, IDENTITAS_CONTOH, SVG_DIAGRAM, buatHasilContoh, pngContoh, skorKompetensiContoh } from "../helpers/rapor-fixture";
import { renderUji } from "../helpers/pdf-uji";
import { bangunHierarkiKompetensi, type SkorKompetensi } from "@/lib/exam/hierarki-kompetensi";

afterEach(() => vi.unstubAllGlobals());

/** Hierarki besar (banyak elemen, subelemen, dan kompetensi) agar tabelnya melewati batas halaman. */
function skorBesar(): SkorKompetensi[] {
  const daftar: SkorKompetensi[] = [];
  for (let e = 1; e <= 6; e++) {
    for (let s = 1; s <= 3; s++) {
      for (let k = 1; k <= 3; k++) {
        daftar.push({
          kompetensiId: `k${e}${s}${k}`,
          elemenId: `e${e}`,
          elemenNama: `Elemen Nomor ${e}`,
          elemenUrutan: e,
          subElemen: `Subelemen ${e}.${s}`,
          kompetensi: `Kompetensi ${e}.${s}.${k} yang menguraikan kemampuan siswa dalam menyelesaikan permasalahan kontekstual`,
          level: `L${k}`,
          jmlBenar: (e + s + k) % 4,
          jmlSoal: 3,
        });
      }
    }
  }
  return daftar;
}

const adaGambarPdf = (pdf: Buffer) => /\/Subtype\s*\/Image/.test(pdf.toString("latin1"));

describe("PDF rapor: Peta Kompetensi bentuk hierarki (sama dengan halaman web)", () => {
  it("judul, kolom, nomor elemen, subelemen dan kompetensi, persen dan jumlah benar, serta legenda", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2 }));
    for (const t of ["Peta Kompetensi", "Capaianmu pada percobaan ini, per Elemen › Subelemen › Kompetensi.", "HIERARKI", "SKOR KAMU", "1. Bilangan", "2. Aljabar", "3. Geometri dan Pengukuran", "4. Data dan Peluang"]) {
      expect(r.teks, t).toContain(t);
    }
    expect(r.teks).toContain("› Bilangan Cacah dan Bulat");
    expect(r.teks).toContain("› Menyelesaikan masalah yang melibatkan operasi hitung bilangan bulat");
    // Bilangan: 4/4 + 2/3 + 1/3 = 7/10 = 70%; kompetensi pertama 4/4 = 100%
    expect(r.teks).toContain("7/10 benar");
    expect(r.teks).toContain("70%");
    expect(r.teks).toContain("4/4 benar");
    expect(r.teks).toContain("100%");
    expect(r.teks).toContain("0/3 benar");
    expect(r.teks).toContain("● Baik (≥70%)");
    expect(r.teks).toContain("● Cukup (50-69%)");
    expect(r.teks).toContain("● Perlu latihan (<50%)");
    // bukan grafik batang: sumbu 75% hanya ada di grafik
    expect(r.teks).not.toContain("75%");
  });

  it("data lama tanpa hierarki: jatuh ke grafik batang per elemen (seperti web), tanpa tabel", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2, hierarki: false }));
    expect(r.teks).toContain("Peta Kompetensi");
    expect(r.teks).not.toContain("HIERARKI");
    expect(r.teks).toContain("Geometri dan Pengukuran");
    expect(r.teks).toContain("75%"); // label sumbu grafik
    expect(r.teks).toContain("29%");
  });

  it("hierarki kosong ([]) dianggap tidak ada: grafik batang", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 2 });
    hasil.hierarkiKompetensi = [];
    const r = await renderUji(hasil);
    expect(r.teks).not.toContain("HIERARKI");
    expect(r.teks).toContain("75%");
  });

  it("tidak ada skor elemen sama sekali: bagian Peta Kompetensi tidak digambar (seperti web)", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 2 });
    hasil.elemenScores = [];
    const r = await renderUji(hasil);
    expect(r.teks).not.toContain("Peta Kompetensi");
    expect(r.teks).not.toContain("HIERARKI");
  });

  it("baris tanpa soal (jmlSoal 0) menampilkan strip, bukan 0% atau NaN", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 2 });
    hasil.hierarkiKompetensi = bangunHierarkiKompetensi([{ ...skorKompetensiContoh()[0]!, jmlBenar: 0, jmlSoal: 0 }]);
    const r = await renderUji(hasil);
    expect(r.teks).toContain("–");
    expect(r.gabung).not.toMatch(/NaN|Infinity/);
  });

  it("tabel yang melewati halaman: kepala kolom digambar ulang, baris elemen tidak tertinggal sendirian di dasar halaman", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 2 });
    hasil.hierarkiKompetensi = bangunHierarkiKompetensi(skorBesar());
    const r = await renderUji(hasil);
    expect(r.kejadian.filter((e) => e === "T:HIERARKI").length).toBeGreaterThanOrEqual(2);
    r.kejadian.forEach((e, i) => {
      if (!/^T:\d+\. Elemen Nomor/.test(e)) return;
      const berikut = r.kejadian.slice(i + 1);
      const iHal = berikut.indexOf("HALAMAN");
      const iBarisBerikut = berikut.findIndex((x) => x.startsWith("T:› "));
      expect(iBarisBerikut, `${e} tanpa baris sesudahnya`).toBeGreaterThan(-1);
      if (iHal !== -1) expect(iBarisBerikut, `${e} terpisah dari baris sesudahnya oleh pindah halaman`).toBeLessThan(iHal);
    });
  });
});

describe("PDF rapor: Analisis Learning Analytics", () => {
  it("empat bagian, tanggal analisis, dan catatan AI", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2 }), { analisis: ANALISIS_CONTOH });
    for (const t of ["Analisis Learning Analytics", "Dianalisis pada 12 Oktober 2026 16.20 WIB", "Ringkasan Kemampuan", "Kelebihan Siswa", "Kekurangan Siswa", "Rekomendasi Belajar"]) {
      expect(r.teks, t).toContain(t);
    }
    expect(r.teks).toContain(ANALISIS_CONTOH.detailJson.ringkasan);
    // butir rekomendasi diawali "• " (latexToPlainText merapikan spasi ganda)
    expect(r.teks).toContain(`• ${ANALISIS_CONTOH.detailJson.rekomendasi[0]}`);
    expect(r.teks).toContain("Analisis Learning Analytics ini dibuat otomatis oleh AI sebagai alat bantu belajar, bukan penilaian final.");
  });

  it("tanpa analisis (null atau detail kosong): bagian tidak digambar", async () => {
    for (const analisis of [null, { detailJson: null }]) {
      const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2 }), { analisis });
      expect(r.teks).not.toContain("Analisis Learning Analytics");
      expect(r.teks).not.toContain("Ringkasan Kemampuan");
    }
  });

  it("field lama (levelKognitif, polaKesalahan) dipakai bila kelebihan/kekurangan tidak ada; bagian yang kosong dilewati", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2 }), {
      analisis: { detailJson: { ringkasan: "Ringkasan uji.", levelKognitif: "Level kognitif kuat.", polaKesalahan: "Pola kesalahan uji.", rekomendasi: [] } },
    });
    expect(r.teks).toContain("Level kognitif kuat.");
    expect(r.teks).toContain("Pola kesalahan uji.");
    expect(r.teks).not.toContain("Rekomendasi Belajar");
    const polos = await renderUji(await buatHasilContoh({ jumlahSoal: 2 }), { analisis: { detailJson: { ringkasan: "Hanya ringkasan." } } });
    expect(polos.teks).toContain("Hanya ringkasan.");
    expect(polos.teks).not.toContain("Kelebihan Siswa");
    expect(polos.teks).not.toContain("Kekurangan Siswa");
  });

  it("ringkasan kosong ditulis '-'; tanggal analisis tidak sah atau kosong tidak mencetak 'Dianalisis'", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2 }), { analisis: { detailJson: { ringkasan: "" }, generatedAt: "bukan tanggal" } });
    expect(r.teks).toContain("-");
    expect(r.gabung).not.toContain("Dianalisis pada");
    expect(r.gabung).not.toMatch(/Invalid|NaN/);
    const tanpaTanggal = await renderUji(await buatHasilContoh({ jumlahSoal: 2 }), { analisis: { detailJson: ANALISIS_CONTOH.detailJson } });
    expect(tanpaTanggal.gabung).not.toContain("Dianalisis pada");
  });

  it("analisis yang sangat panjang (tiap bagian lebih dari satu halaman) tetap tercetak utuh dengan jumlah halaman wajar", async () => {
    const panjang = "Kalimat analisis yang panjang dan berulang untuk menguji pemotongan halaman. ".repeat(120);
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2 }), {
      analisis: { detailJson: { ringkasan: panjang, kelebihanSiswa: panjang, kekuranganSiswa: panjang, rekomendasi: [panjang, panjang] } },
    });
    // tiap bagian ~8.800 karakter (sekitar 1,5 halaman): total sekitar 10 halaman analisis + isi lain
    expect(r.halaman).toBeLessThanOrEqual(18);
    for (const t of ["Ringkasan Kemampuan", "Kelebihan Siswa", "Kekurangan Siswa", "Rekomendasi Belajar", "Rincian Jawaban"]) expect(r.teks, t).toContain(t);
    // tiga paragraf (ringkasan, kelebihan, kekurangan) dan dua butir rekomendasi
    expect(r.teks.filter((t) => t.startsWith("Kalimat analisis")).length).toBe(3);
    expect(r.teks.filter((t) => t.startsWith("• Kalimat analisis")).length).toBe(2);
  });

  it("analisis berukuran biasa tidak memotong blok antar halaman dan tidak menimbulkan halaman kosong berantai", async () => {
    const sedang = "Kalimat analisis berukuran sedang untuk menguji pemotongan halaman. ".repeat(14);
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2, hierarki: false }), {
      analisis: { detailJson: { ringkasan: sedang, kelebihanSiswa: sedang, kekuranganSiswa: sedang, rekomendasi: [sedang, sedang, sedang] } },
    });
    expect(r.halaman).toBeLessThanOrEqual(6);
    r.kejadian.forEach((e, i) => {
      if (e === "HALAMAN") expect(r.kejadian[i + 1], "halaman kosong berantai").not.toBe("HALAMAN");
    });
  });
});

describe("PDF rapor: Rincian Jawaban", () => {
  it("kepala soal, format, Benar/Salah, pilihan dengan penanda jawaban dan kunci, soal kategori, dan pembahasan", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 4 }));
    expect(r.teks).toContain("Rincian Jawaban");
    expect(r.teks).toContain("4 soal · 2 benar · 2 salah");
    for (const t of ["Soal 1", "Soal 2", "Soal 3", "Soal 4", "·  PG", "·  PG Kompleks", "·  PG Kategori", "Benar", "Salah", "Pilihan jawaban", "Pembahasan"]) {
      expect(r.teks, t).toContain(t);
    }
    expect(r.teks).toContain("✗ Jawaban siswa (salah)");
    expect(r.teks).toContain("✓ Kunci jawaban");
    expect(r.teks).toContain("✓ Jawaban siswa (benar)");
    expect(r.teks).toContain("A. -1");
    expect(r.teks).toContain("B. 43");
    // soal kategori: label dari categoryId, bukan UUID mentah
    expect(r.teks).toContain("Kunci & Jawaban Siswa");
    expect(r.teks).toContain("Pilihan kategori: Benar  /  Salah");
    expect(r.teks).toContain("Siswa: Benar (benar)");
    expect(r.teks).toContain("Siswa: Salah (benar)");
    expect(r.gabung).not.toMatch(/k1|k2/);
  });

  it("jawaban kategori yang salah menampilkan kuncinya; jawaban kosong ditulis 'Kosong'", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 3 });
    // soal ke-3 (indeks 2) berformat pg_kategori dan dijawab salah pada pernyataan pertama
    const kat = hasil.perSoal[2]!;
    kat.jawabanJson = { s1: "k2" };
    const r = await renderUji(hasil);
    expect(r.teks).toContain("Siswa: Salah (Kunci: Benar)");
    expect(r.teks).toContain("Siswa: Kosong (Kunci: Salah)");
  });

  it("rumus LaTeX diubah jadi teks yang terbaca, tidak ada sumber LaTeX mentah", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 1 }));
    expect(r.gabung).toContain("30 - 15 ÷ (-3) + 4 × 2");
    expect(r.gabung).not.toMatch(/\\div|\\times|\$/);
  });

  it("stimulus dicetak dengan judulnya; keterangan gambar (caption) TIDAK dicetak", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 4, stimulus: true, media: true }));
    expect(r.teks).toContain("Stimulus: Bacaan 1");
    expect(r.gabung).toContain("Pak Budi menjual 3 jenis buah di pasar");
    expect(r.gabung).not.toContain("Keterangan yang tidak boleh dicetak");
  });

  it("gambar soal: diagram SVG (vektor) dan foto (raster) dicetak dengan labelnya", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 1, media: true }));
    expect(r.teks).toContain("Diagram Presisi (SVG)");
    expect(r.teks).toContain("Foto Ilustrasi");
    expect(adaGambarPdf(r.pdf)).toBe(true);
    // diagram vektor memakai font rapor: teks diagramnya ikut tergambar
    expect(r.gabung).not.toContain("gambar tidak dapat dimuat");
  });

  it("foto yang gagal diambil (jaringan putus): keterangan singkat, rapor tetap jadi dan soal lain tetap tercetak", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("jaringan putus");
    }));
    const hasil = await buatHasilContoh({ jumlahSoal: 2 });
    hasil.perSoal[0]!.media = JSON.stringify({ tipe: "single", items: [{ tipe: "foto", label: "Foto Ilustrasi", url: "https://contoh.invalid/foto.png" }] });
    const r = await renderUji(hasil);
    expect(r.teks).toContain("[Foto Ilustrasi: gambar tidak dapat dimuat di rapor ini, lihat di aplikasi]");
    expect(r.teks).toContain("Soal 2");
    expect(r.pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("foto WebP dan GIF (tidak didukung pdfkit) diubah ke PNG, tidak menggagalkan rapor", async () => {
    const dasar = Buffer.from((await pngContoh(200, 120)).split(",")[1]!, "base64");
    const webp = `data:image/webp;base64,${(await sharp(dasar).webp().toBuffer()).toString("base64")}`;
    const gif = `data:image/gif;base64,${(await sharp(dasar).gif().toBuffer()).toString("base64")}`;
    const hasil = await buatHasilContoh({ jumlahSoal: 2 });
    hasil.perSoal[0]!.media = JSON.stringify({ tipe: "multi", items: [{ tipe: "foto", label: "Foto WebP", url: webp }, { tipe: "foto", label: "Foto GIF", url: gif }] });
    const r = await renderUji(hasil);
    expect(r.teks).toContain("Foto WebP");
    expect(r.teks).toContain("Foto GIF");
    expect(r.gabung).not.toContain("gambar tidak dapat dimuat");
    expect(adaGambarPdf(r.pdf)).toBe(true);
  });

  it("SVG rusak (atribut ganda) tidak digambar dan tidak menggagalkan rapor", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 1 });
    hasil.perSoal[0]!.media = JSON.stringify({ tipe: "single", items: [{ tipe: "svg", label: "Diagram", svgContent: '<svg xmlns="http://www.w3.org/2000/svg"><line x="1" y="2" x="3"/></svg>' }] });
    const r = await renderUji(hasil);
    expect(r.teks).toContain("[Diagram: gambar tidak dapat dimuat di rapor ini, lihat di aplikasi]");
    expect(r.pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("SVG yang menunjuk berkas gambar di disk server tidak membaca berkas itu: tidak ada gambar yang tertanam di PDF", async () => {
    // Berkas PNG sungguhan di disk. Bila pembaca SVG mengikuti tautan berkas, PNG ini ikut tertanam di PDF (objek /Image);
    // isi soal ditulis admin/guru, jadi rapor tidak boleh membaca berkas server atas permintaan isi SVG.
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "rapor-svg-"));
    try {
      const berkas = path.join(folder, "rahasia.png");
      fs.writeFileSync(berkas, Buffer.from((await pngContoh(120, 80)).split(",")[1]!, "base64"));
      const jahat = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100"><image xlink:href="${berkas}" x="0" y="0" width="100" height="100"/><text x="5" y="50">Aman</text></svg>`;
      const hasil = await buatHasilContoh({ jumlahSoal: 1 });
      hasil.perSoal[0]!.media = JSON.stringify({ tipe: "single", items: [{ tipe: "svg", label: "Diagram aman", svgContent: jahat }] });
      const r = await renderUji(hasil);
      expect(r.teks).toContain("Diagram aman");
      // diagramnya sendiri tetap digambar (bukan keterangan gagal); hanya gambar yang menunjuk berkas di disk yang dilewati
      expect(r.gabung).not.toContain("gambar tidak dapat dimuat");
      expect(r.gabung).not.toContain("gagal digambar");
      expect(adaGambarPdf(r.pdf)).toBe(false);
      expect(r.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  it("SVG yang menanam gambar sebagai data URI tetap tergambar (penjaga berkas tidak berlebihan)", async () => {
    const tertanam = (await pngContoh(120, 80)).trim();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100"><image xlink:href="${tertanam}" x="0" y="0" width="100" height="70"/></svg>`;
    const hasil = await buatHasilContoh({ jumlahSoal: 1 });
    hasil.perSoal[0]!.media = JSON.stringify({ tipe: "single", items: [{ tipe: "svg", label: "Diagram tertanam", svgContent: svg }] });
    const r = await renderUji(hasil);
    expect(r.teks).toContain("Diagram tertanam");
    expect(adaGambarPdf(r.pdf)).toBe(true);
  });

  it("media berupa alamat polos (format lama) dan JSON rusak: alamat diproses, JSON rusak diabaikan", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 2 });
    hasil.perSoal[0]!.media = await pngContoh(160, 100);
    hasil.perSoal[1]!.media = "{rusak";
    const r = await renderUji(hasil);
    expect(r.teks).toContain("Foto Ilustrasi");
    expect(r.teks).toContain("Soal 2");
    expect(adaGambarPdf(r.pdf)).toBe(true);
  });

  it("gambar di dalam teks soal (markdown): foto data URI terpasang; yang tidak bisa dimuat diberi keterangan", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 2 });
    hasil.perSoal[0]!.teks = `Perhatikan gambar berikut. ![](${await pngContoh(160, 100)}) Berapa luasnya?`;
    hasil.perSoal[1]!.teks = "Gambar rusak ![](https://contoh.invalid/tidak-ada.png) di tengah soal.";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(0), headers: { get: () => null } })));
    const r = await renderUji(hasil);
    expect(r.gabung).toContain("Perhatikan gambar berikut.");
    expect(r.gabung).toContain("Berapa luasnya?");
    expect(r.gabung).toContain("[Gambar gagal dimuat]");
    expect(adaGambarPdf(r.pdf)).toBe(true);
  });

  it("kunci dan pembahasan disembunyikan bila tidak boleh ditampilkan (canShowPembahasan false)", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 2 });
    (hasil as { canShowPembahasan: boolean }).canShowPembahasan = false;
    const r = await renderUji(hasil);
    expect(r.teks).toContain("Soal 1");
    expect(r.teks).not.toContain("Pilihan jawaban");
    expect(r.teks).not.toContain("Pembahasan");
    expect(r.gabung).not.toContain("Kunci jawaban");
  });

  it("tanpa soal: judul bagian dan keterangan, tanpa 'NaN' atau 'undefined'", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 0 });
    const r = await renderUji(hasil);
    expect(r.teks).toContain("Rincian Jawaban");
    expect(r.teks).toContain("Tidak ada soal pada percobaan ini.");
    expect(r.teks).toContain("0 / 0");
    expect(r.gabung).not.toMatch(/NaN|undefined/);
  });

  it("pembahasan sangat panjang (lebih dari satu halaman) tetap tercetak seluruhnya tanpa halaman kosong berantai", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 2 });
    const bagian = Array.from({ length: 160 }, (_, i) => `Langkah ke-${i + 1}: lakukan perhitungan dengan teliti.`);
    hasil.perSoal[0]!.pembahasan = bagian.join("\n");
    const r = await renderUji(hasil);
    expect(r.gabung).toContain("Langkah ke-1:");
    expect(r.gabung).toContain("Langkah ke-160:");
    // 160 baris pembahasan (sekitar 2 halaman) di soal pertama; soal kedua tetap tercetak sesudahnya
    expect(r.halaman).toBeLessThanOrEqual(9);
    expect(r.teks).toContain("Soal 2");
  });

  it("80 soal: jumlah halaman wajar, tidak ada halaman kosong berantai, tiap soal tercetak sekali", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 80, media: true, stimulus: true }), { analisis: ANALISIS_CONTOH, identitas: IDENTITAS_CONTOH });
    expect(r.halaman).toBeLessThanOrEqual(60);
    for (const nomor of [1, 40, 80]) expect(r.teks.filter((t) => t === `Soal ${nomor}`)).toHaveLength(1);
    r.kejadian.forEach((e, i) => {
      if (e === "HALAMAN") expect(r.kejadian[i + 1], "halaman kosong berantai").not.toBe("HALAMAN");
    });
  }, 120000);
});

describe("PDF rapor: bentuk berkas", () => {
  it("PDF sah (kepala %PDF dan akhir %%EOF) dan memuat font Unicode (DejaVu) untuk simbol", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2 }), { identitas: IDENTITAS_CONTOH });
    expect(r.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(r.pdf.subarray(-8).toString()).toContain("%%EOF");
    expect(r.pdf.toString("latin1")).toMatch(/DejaVu/);
  });

  it("diagram SVG contoh yang dipakai tes sendiri lolos validasi impor (pangkal uji ini sah)", async () => {
    const { validasiSvgSumber } = await import("@/lib/soal-import/media");
    expect(validasiSvgSumber(SVG_DIAGRAM)).toBeNull();
  });
});
