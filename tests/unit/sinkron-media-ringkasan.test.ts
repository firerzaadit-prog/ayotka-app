import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RingkasanSinkronMedia, SinkronMediaCard } from "@/components/soal-import/sinkron-media-card";
import type { LaporanSinkronMedia, LaporanSinkronMediaPaket } from "@/lib/soal-import/sinkron-media";

const paket = (o: Partial<LaporanSinkronMediaPaket> = {}): LaporanSinkronMediaPaket => ({
  packageId: "p1",
  nama: "PAKET A5 (A05-SD-MAT)",
  kodeSumber: "A05-SD-MAT",
  soal: 30,
  diperbarui: 0,
  sudahGanda: 0,
  sumberSatuGambar: 0,
  diagramTidakValid: 0,
  tanpaFotoTersimpan: 0,
  tidakBisaDicocokkan: 0,
  berubahSaatProses: 0,
  galatSumber: null,
  contoh: [],
  ...o,
});
const laporan = (jalankan: boolean, daftar: LaporanSinkronMediaPaket[], total: Partial<LaporanSinkronMedia["total"]> = {}): LaporanSinkronMedia => ({
  jalankan,
  paket: daftar,
  total: { paket: daftar.length, soal: 30 * daftar.length, diperbarui: daftar.reduce((a, p) => a + p.diperbarui, 0), sudahGanda: 0, sumberSatuGambar: 0, perluDicek: 0, ...total },
});
const teks = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const html = (l: LaporanSinkronMedia) => renderToStaticMarkup(createElement(RingkasanSinkronMedia, { laporan: l }));

describe("RingkasanSinkronMedia", () => {
  it("simulasi dengan temuan: jelas BELUM ada yang diubah, kolom 'Akan diperbarui', contoh soal tampil", () => {
    const t = teks(html(laporan(false, [paket({ diperbarui: 2, contoh: ["Di sanggar kriya sekolah, Bu Ratna menunjukkan dua potongan kayu"] })])));
    expect(t).toContain("Ditemukan 2 soal di 1 paket");
    expect(t).toContain("Belum ada yang diubah");
    expect(t).toContain('tekan "Terapkan"');
    expect(t).toContain("Akan diperbarui");
    expect(t).toContain("PAKET A5 (A05-SD-MAT)");
    expect(t).toContain("Contoh: Di sanggar kriya sekolah");
  });

  it("setelah diterapkan: pesan sukses dengan angka, kolom 'Diperbarui', dan penjelasan apa yang dilihat siswa", () => {
    const t = teks(html(laporan(true, [paket({ diperbarui: 4 }), paket({ packageId: "p2", nama: "PAKET B", diperbarui: 1 })])));
    expect(t).toContain("5 soal di 2 paket sudah diperbarui menjadi dua gambar");
    expect(t).toContain("tab Diagram Presisi dan Foto Ilustrasi");
    expect(t).toMatch(/Diperbarui/);
    expect(t).not.toContain("Akan diperbarui");
    expect(t).not.toContain("Belum ada yang diubah");
  });

  it("tidak ada yang perlu diperbarui: pesan tenang dan tanpa tabel", () => {
    const h = html(laporan(false, [paket({ sudahGanda: 3 })], { sudahGanda: 3 }));
    expect(teks(h)).toContain("Tidak ada soal yang perlu diperbarui");
    expect(h).not.toContain("<table");
  });

  it("paket yang tidak ada urusannya tidak ditampilkan di tabel; yang punya hal perlu dicek tampil dengan rinciannya", () => {
    const t = teks(
      html(
        laporan(
          false,
          [
            paket({ packageId: "aman", nama: "PAKET AMAN" }),
            paket({
              packageId: "cek",
              nama: "PAKET BERMASALAH",
              diagramTidakValid: 1,
              tanpaFotoTersimpan: 2,
              tidakBisaDicocokkan: 3,
              berubahSaatProses: 4,
              galatSumber: "koneksi putus",
            }),
          ],
          { perluDicek: 11 },
        ),
      ),
    );
    expect(t).not.toContain("PAKET AMAN");
    expect(t).toContain("PAKET BERMASALAH");
    expect(t).toContain("1 diagram di sumber rusak");
    expect(t).toContain("2 soal belum punya foto tersimpan");
    expect(t).toContain("3 soal teksnya tidak cocok dengan sumber");
    expect(t).toContain("4 soal berubah selagi proses berjalan");
    expect(t).toContain("Soal sumber tidak bisa dibaca: koneksi putus");
    expect(t).toContain("11 perlu dicek");
  });

  it("teks dari sumber di-escape (tidak menyisipkan HTML)", () => {
    const h = html(laporan(false, [paket({ diperbarui: 1, contoh: ["<img src=x onerror=alert(1)>"], galatSumber: "<script>x</script>" })]));
    expect(h).not.toContain("<img src=x");
    expect(h).not.toContain("<script>x");
    expect(h).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});

describe("SinkronMediaCard (keadaan awal)", () => {
  const h = renderToStaticMarkup(createElement(SinkronMediaCard));

  it("menjelaskan masalahnya dan hanya menawarkan 'Periksa dulu' (belum ada tombol Terapkan sebelum ada hasil pemeriksaan)", () => {
    const t = teks(h);
    expect(t).toContain("Gambar soal yang sudah diimpor");
    expect(t).toContain("hanya menyimpan fotonya");
    expect(t).toContain("aman diulang");
    expect(t).toContain("Periksa dulu");
    expect(t).not.toContain("Terapkan");
    expect(h).not.toContain("ringkasan-sinkron-media");
  });
});
