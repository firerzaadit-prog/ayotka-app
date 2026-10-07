import "server-only";
import { competencyTier, COMPETENCY_TIER_HEX } from "@/lib/exam/competency-color";
import type { BarisIndikatorSekolah } from "@/lib/indikator/daya-serap";
import type { DataLaporanSekolah } from "@/lib/indikator/laporan-sekolah";
import { formatPersen, formatSelisih } from "@/lib/indikator/tampilan";
import { X0, buatPenulis, gambarDaftarFokus, gambarKelompok } from "@/lib/pdf/indikator-gambar";
import { COLOR, setupFonts, type PdfFonts } from "@/lib/pdf/pdf-umum";

/** Daftar siswa perlu perhatian dibatasi di PDF supaya tetap ringkas; daftar lengkap ada di Excel. */
const MAKS_SISWA_DI_PDF = 40;

function nomorHalaman(doc: PDFKit.PDFDocument, fonts: PdfFonts, halaman: number, total: number) {
  // Teks di zona margin bawah: margin bawah dinolkan sementara supaya pdfkit tidak menambah halaman kosong.
  const margin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.font(fonts.regular).fontSize(8).fillColor(COLOR.faint).text(`AyoTKA · Laporan Daya Serap per Indikator · Halaman ${halaman} dari ${total}`, 0, doc.page.height - 30, {
    width: doc.page.width,
    align: "center",
  });
  doc.page.margins.bottom = margin;
}

/**
 * Render laporan daya serap per indikator sebuah sekolah (satu mata pelajaran) ke PDFDocument yang dibuat pemanggil.
 * Mengikuti aturan gambar PDF AyoTKA: koordinat eksplisit, tinggi diukur dulu, pindah halaman diputuskan sebelum
 * menggambar blok (lihat lib/pdf/indikator-gambar.ts).
 */
export async function renderLaporanSekolahPdf(
  doc: PDFKit.PDFDocument,
  data: DataLaporanSekolah,
  periodeLabel: string,
  logoBuffer: Buffer | null,
) {
  const fonts = setupFonts(doc);
  doc.font(fonts.regular);
  const contentWidth = doc.page.width - 96;
  const { toText, tinggi, tulis, pastikanMuat, dot } = buatPenulis(doc, fonts);
  const lap = data.laporan;

  // ---- Kepala ----
  const headerH = 118;
  const gradient = doc.linearGradient(0, 0, doc.page.width, headerH);
  gradient.stop(0, COLOR.primaryFrom).stop(1, COLOR.primaryTo);
  doc.rect(0, 0, doc.page.width, headerH).fill(gradient);
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, X0, 30, { width: 34, height: 34, fit: [34, 34] });
    } catch {
      // Format tidak didukung pdfkit: lanjut tanpa logo.
    }
  }
  tulis("AyoTKA", 90, 36, 200, 11, "#ffffff", true);
  tulis("Laporan Daya Serap per Indikator", X0, 64, contentWidth * 0.62, 14.5, "#ffffff", true);
  const kanan = contentWidth * 0.4;
  tulis(toText(data.sekolah.nama), X0 + contentWidth - kanan, 38, kanan, 10, "#e0e7ff", false, "right");
  tulis(toText(`${data.mapel.nama} ${dot} ${data.mapel.jenjang}`), X0 + contentWidth - kanan, 54, kanan, 9, "#c7d2fe", false, "right");
  tulis(toText(`Periode: ${periodeLabel}`), X0 + contentWidth - kanan, 68, kanan, 8.5, "#c7d2fe", false, "right");
  doc.y = headerH + 22;

  // ---- Kartu ringkasan ----
  const skorTotal = lap ? lap.kelompok.reduce((a, k) => a + k.skor, 0) : 0;
  const maksTotal = lap ? lap.kelompok.reduce((a, k) => a + k.skorMaks, 0) : 0;
  const kartu: Array<[string, string]> = [
    ["SISWA MENGERJAKAN", String(data.jumlahSiswaMengerjakan)],
    ["PERCOBAAN DIHITUNG", String(data.jumlahPercobaan)],
    [
      "CAKUPAN INDIKATOR RESMI",
      lap && lap.jumlahJawaban > 0 ? formatPersen((lap.jawabanBerindikator / lap.jumlahJawaban) * 100, 0) : "-",
    ],
    ["DAYA SERAP KESELURUHAN", lap && maksTotal > 0 ? formatPersen((skorTotal / maksTotal) * 100, 1) : "-"],
  ];
  const celah = 10;
  const lebarKartu = (contentWidth - celah * (kartu.length - 1)) / kartu.length;
  const yKartu = doc.y;
  kartu.forEach(([label, nilai], i) => {
    const x = X0 + i * (lebarKartu + celah);
    doc.roundedRect(x, yKartu, lebarKartu, 56, 8).fill(COLOR.cardBg).stroke(COLOR.border);
    tulis(label, x + 10, yKartu + 10, lebarKartu - 20, 7, COLOR.muted);
    tulis(nilai, x + 10, yKartu + 25, lebarKartu - 20, 17, COLOR.primaryFrom, true);
  });
  doc.y = yKartu + 56 + 12;

  if (!lap) {
    pastikanMuat(60);
    const pesan =
      "Belum ada soal berindikator resmi Kemendikdasmen pada percobaan di rentang ini, jadi daya serap per indikator belum bisa dihitung. Soal yang diimpor dari soal.ayotka.id otomatis tertaut ke indikator resmi setelah master indikator diunggah admin pusat.";
    const h = tinggi(pesan, 9, contentWidth - 24);
    const y = doc.y;
    doc.roundedRect(X0, y, contentWidth, h + 20, 8).fill(COLOR.warnBg);
    tulis(pesan, X0 + 12, y + 10, contentWidth - 24, 9, COLOR.warnText);
    doc.y = y + h + 28;
  } else {
    // ---- Cara membaca ----
    const catatan =
      "Daya serap = skor yang diperoleh dibagi skor maksimum pada indikator, dari percobaan PERTAMA tiap siswa pada tiap paket. Rerata nasional dari portal resmi daya serap TKA Kemendikdasmen adalah rujukan; vonis hanya diberikan di tingkat kelompok. Alumni tetap dihitung.";
    tulis(catatan, X0, doc.y, contentWidth, 7.5, COLOR.faint);
    doc.y += tinggi(catatan, 7.5, contentWidth) + 12;

    // ---- Sebaran siswa ----
    const total = lap.sebaran.baik + lap.sebaran.cukup + lap.sebaran.kurang;
    pastikanMuat(110);
    tulis("Sebaran Siswa", X0, doc.y, contentWidth, 12, COLOR.ink, true);
    doc.y += 20;
    const tier: Array<[string, number, "baik" | "cukup" | "kurang"]> = [
      ["Baik (70% ke atas)", lap.sebaran.baik, "baik"],
      ["Cukup (50-69%)", lap.sebaran.cukup, "cukup"],
      ["Perlu latihan (di bawah 50%)", lap.sebaran.kurang, "kurang"],
    ];
    for (const [nama, jumlah, t] of tier) {
      const y = doc.y;
      const persen = total > 0 ? (jumlah / total) * 100 : 0;
      tulis(nama, X0, y + 2, 150, 8.5, COLOR.ink, true);
      doc.roundedRect(X0 + 156, y + 2, contentWidth - 156 - 90, 10, 4).fill(COLOR.cardBg);
      if (persen > 0) doc.roundedRect(X0 + 156, y + 2, Math.max(4, ((contentWidth - 156 - 90) * persen) / 100), 10, 4).fill(COMPETENCY_TIER_HEX[t]);
      tulis(`${jumlah} siswa (${formatPersen(persen, 0)})`, X0 + contentWidth - 84, y + 3, 84, 8, COMPETENCY_TIER_HEX[t], true, "right");
      doc.y = y + 20;
    }
    doc.y += 8;

    // ---- Per kelompok dan indikator ----
    pastikanMuat(120);
    tulis(`Daya Serap per ${lap.label[0]}`, X0, doc.y, contentWidth, 14, COLOR.ink, true);
    doc.y += 20;
    tulis(toText(lap.label.join(" > ")), X0, doc.y, contentWidth, 8.5, COLOR.muted);
    doc.y += 18;
    gambarKelompok(doc, fonts, contentWidth, lap.label, lap.kelompok, (b: BarisIndikatorSekolah) => `${b.jmlSiswa} siswa ${dot} ${b.jmlSoal} jawaban`);

    // ---- Learning Analytics otomatis ----
    pastikanMuat(150);
    tulis("Learning Analytics Otomatis", X0, doc.y, contentWidth, 14, COLOR.ink, true);
    doc.y += 20;
    doc.rect(X0, doc.y, contentWidth, 3).fill(COLOR.primaryFrom);
    doc.y += 10;
    const penjelasan = "Dihitung otomatis dari hasil siswa, tanpa analisis AI tambahan. Analisis AI per siswa tersedia di halaman detail siswa.";
    tulis(penjelasan, X0, doc.y, contentWidth, 8, COLOR.muted);
    doc.y += tinggi(penjelasan, 8, contentWidth) + 12;

    gambarDaftarFokus(
      doc,
      fonts,
      contentWidth,
      "Prioritas remedial",
      "Indikator dengan daya serap terendah (di bawah 70%) dan cukup banyak jawaban (minimal 5).",
      lap.prioritasRemedial,
      "Tidak ada indikator di bawah 70% dengan jawaban yang cukup.",
      (b) => `${b.jmlSiswa} siswa ${dot} ${b.jmlSoal} jawaban`,
    );
    gambarDaftarFokus(
      doc,
      fonts,
      contentWidth,
      "Indikator di bawah rerata nasional",
      "Daya serap sekolah ini lebih rendah daripada rerata nasional; selisih terbesar lebih dulu.",
      lap.diBawahNasional,
      "Tidak ada indikator di bawah rerata nasional (dengan jawaban yang cukup).",
      (b) => (b.nasional === null ? null : `nasional ${formatPersen(b.nasional, 1)} (${formatSelisih(b.dayaSerap - b.nasional)})`),
    );

    // ---- Siswa perlu perhatian ----
    const judul = "Siswa yang perlu perhatian";
    const desk = "Daya serap keseluruhan di bawah 50% pada mapel ini, terendah lebih dulu, beserta dua indikator terlemahnya.";
    pastikanMuat(tinggi(judul, 10, contentWidth, true) + tinggi(desk, 8, contentWidth) + 60);
    const yj = doc.y;
    tulis(judul, X0, yj, contentWidth, 10, COLOR.ink, true);
    tulis(desk, X0, yj + tinggi(judul, 10, contentWidth, true) + 2, contentWidth, 8, COLOR.muted);
    doc.y = yj + tinggi(judul, 10, contentWidth, true) + tinggi(desk, 8, contentWidth) + 8;

    if (lap.siswaPerhatian.length === 0) {
      tulis("Tidak ada siswa di bawah 50%.", X0, doc.y, contentWidth, 8.5, COLOR.body);
      doc.y += 18;
    } else {
      const tampil = lap.siswaPerhatian.slice(0, MAKS_SISWA_DI_PDF);
      for (const s of tampil) {
        const nama = toText(s.nisn ? `${s.nama} (${s.nisn})` : s.nama);
        const terlemah = toText(
          s.terlemah.length === 0
            ? "-"
            : `Terlemah: ${s.terlemah.map((b) => `${b.indikator} (${formatPersen(b.dayaSerap, 0)})`).join("; ")}`,
        );
        const hNama = tinggi(nama, 8.5, contentWidth - 70, true);
        const hTerlemah = tinggi(terlemah, 7.5, contentWidth - 70);
        pastikanMuat(hNama + hTerlemah + 10);
        const y = doc.y;
        tulis(nama, X0, y, contentWidth - 70, 8.5, COLOR.ink, true);
        tulis(formatPersen(s.dayaSerap, 0), X0 + contentWidth - 60, y, 60, 8.5, COMPETENCY_TIER_HEX[competencyTier(s.dayaSerap)], true, "right");
        tulis(terlemah, X0, y + hNama + 1, contentWidth - 70, 7.5, COLOR.muted);
        doc.lineWidth(0.4).moveTo(X0, y + hNama + hTerlemah + 6).lineTo(X0 + contentWidth, y + hNama + hTerlemah + 6).strokeColor(COLOR.border).stroke();
        doc.y = y + hNama + hTerlemah + 9;
      }
      if (lap.siswaPerhatian.length > tampil.length) {
        const sisa = `...dan ${lap.siswaPerhatian.length - tampil.length} siswa lainnya (daftar lengkap ada di unduhan Excel).`;
        pastikanMuat(tinggi(sisa, 8, contentWidth) + 8);
        tulis(sisa, X0, doc.y + 2, contentWidth, 8, COLOR.faint);
        doc.y += tinggi(sisa, 8, contentWidth) + 10;
      }
    }
  }

  // ---- Nomor halaman ----
  const rentang = doc.bufferedPageRange();
  for (let i = 0; i < rentang.count; i++) {
    doc.switchToPage(rentang.start + i);
    nomorHalaman(doc, fonts, i + 1, rentang.count);
  }
}
