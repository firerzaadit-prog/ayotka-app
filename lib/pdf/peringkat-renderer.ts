import "server-only";
import { COMPETENCY_TIER_HEX, competencyTier } from "@/lib/exam/competency-color";
import { formatSkor } from "@/lib/hasil-tryout/format";
import type { BarisPeringkatSiswa } from "@/lib/hasil-tryout/susun";
import { X0, buatPenulis } from "@/lib/pdf/indikator-gambar";
import { COLOR, setupFonts, type PdfFonts } from "@/lib/pdf/pdf-umum";

/**
 * Laporan Peringkat Siswa (PDF) untuk admin sekolah: kepala berlogo, syarat yang dipakai, ringkasan, lalu tabel peringkat
 * dari nilai tertinggi ke terendah. Mengikuti aturan gambar PDF AyoTKA (lib/pdf/indikator-gambar.ts): setiap teks di koordinat
 * eksplisit, tinggi baris tetap, dan pindah halaman diputuskan SEBELUM sebuah baris digambar (baris tidak pernah terbelah;
 * kepala tabel diulang di tiap halaman). Isinya sama dengan layar dan unduhan Excel (data dari lib/hasil-tryout).
 */
export type DataPeringkatPdf = {
  sekolah: string;
  /** Syarat aktif, satu baris per syarat ("Jenis: Try Out Sekolah"); kosong = semua data. */
  syarat: string[];
  /** Tanggal cetak yang sudah diformat, mis. "13 Oktober 2026". */
  dicetak: string;
  ringkasan: { jumlahSiswa: number; jumlahTryOut: number; rataRata: number | null };
  baris: BarisPeringkatSiswa[];
};

const TINGGI_KEPALA = 96;
const TINGGI_BARIS = 27;
const TINGGI_HEADER_TABEL = 24;

const WARNA_PERINGKAT: Record<number, { bg: string; teks: string }> = {
  1: { bg: "#fef3c7", teks: "#92400e" },
  2: { bg: "#e2e8f0", teks: "#0f172a" },
  3: { bg: "#ffedd5", teks: "#9a3412" },
};

/** Potong teks supaya muat dalam lebar tertentu (satu baris), dengan "…" di ujung bila terpotong. */
export function muatDalam(doc: PDFKit.PDFDocument, teks: string, lebar: number): string {
  const bersih = teks.replace(/\s+/g, " ").trim();
  if (doc.widthOfString(bersih) <= lebar) return bersih;
  let akhir = bersih.length;
  while (akhir > 1 && doc.widthOfString(`${bersih.slice(0, akhir).trimEnd()}…`) > lebar) akhir--;
  return `${bersih.slice(0, akhir).trimEnd()}…`;
}

function nomorHalaman(doc: PDFKit.PDFDocument, fonts: PdfFonts, sekolah: string, halaman: number, total: number) {
  // Teks di zona margin bawah: margin bawah dinolkan sementara supaya pdfkit tidak menambah halaman kosong.
  const margin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  const H = doc.page.height;
  const W = doc.page.width;
  doc.lineWidth(0.5).moveTo(X0, H - 40).lineTo(W - X0, H - 40).strokeColor(COLOR.border).stroke();
  doc.font(fonts.regular).fontSize(fonts.sz(7.5)).fillColor(COLOR.faint);
  doc.text(`AyoTKA · Peringkat Siswa · ${muatDalam(doc, sekolah, 260)}`, X0, H - 32, { width: W - 2 * X0 - 110, align: "left", lineBreak: false });
  doc.text(`Halaman ${halaman} dari ${total}`, W - X0 - 100, H - 32, { width: 100, align: "right", lineBreak: false });
  doc.page.margins.bottom = margin;
}

export async function renderPeringkatPdf(doc: PDFKit.PDFDocument, data: DataPeringkatPdf, logo: Buffer | null): Promise<void> {
  const fonts = setupFonts(doc);
  doc.font(fonts.regular);
  doc.info.Title = `Peringkat Siswa - ${data.sekolah.slice(0, 100)}`;
  doc.info.Author = "AyoTKA";
  doc.info.Creator = "AyoTKA";
  const W = doc.page.width;
  const CW = W - 2 * X0;
  const { toText, tulis, pastikanMuat } = buatPenulis(doc, fonts);

  // ---- kepala ----
  const gradien = doc.linearGradient(0, 0, W, TINGGI_KEPALA);
  gradien.stop(0, COLOR.primaryFrom).stop(1, COLOR.primaryTo);
  doc.rect(0, 0, W, TINGGI_KEPALA).fill(gradien);
  let xMerek = X0;
  if (logo) {
    try {
      doc.image(logo, X0, 22, { fit: [34, 34] });
      xMerek = X0 + 44;
    } catch {
      // Format tidak didukung pdfkit: lanjut tanpa logo.
    }
  }
  tulis("AyoTKA", xMerek, 24, 200, 12, "#ffffff", true);
  tulis("Latihan Tes Kemampuan Akademik", xMerek, 40, 240, 7.5, "#c7d2fe");
  tulis("Peringkat Siswa", X0, 60, CW * 0.6, 20, "#ffffff", true);
  tulis(toText(data.sekolah), X0 + CW * 0.5, 26, CW * 0.5, 10, "#e0e7ff", true, "right");
  tulis(`Dicetak ${data.dicetak}`, X0 + CW * 0.5, 42, CW * 0.5, 7.5, "#c7d2fe", false, "right");
  doc.y = TINGGI_KEPALA + 18;

  // ---- syarat ----
  const teksSyarat = data.syarat.length ? data.syarat.join("  ·  ") : "Semua data (semua jenis try out, semua mata pelajaran, semua waktu)";
  const tinggiSyarat = doc.font(fonts.regular).fontSize(fonts.sz(8)).heightOfString(toText(teksSyarat), { width: CW });
  const ySyarat = doc.y;
  tulis(toText(teksSyarat), X0, ySyarat, CW, 8, COLOR.muted);
  doc.y = ySyarat + tinggiSyarat + 10;

  // ---- ringkasan ----
  const kartu: Array<[string, string]> = [
    ["SISWA DIPERINGKAT", String(data.ringkasan.jumlahSiswa)],
    ["TRY OUT DIKERJAKAN", String(data.ringkasan.jumlahTryOut)],
    ["RATA-RATA NILAI", formatSkor(data.ringkasan.rataRata)],
  ];
  const celah = 10;
  const lebarKartu = (CW - celah * (kartu.length - 1)) / kartu.length;
  const yKartu = doc.y;
  kartu.forEach(([label, nilai], i) => {
    const x = X0 + i * (lebarKartu + celah);
    doc.roundedRect(x, yKartu, lebarKartu, 50, 8).fillAndStroke(COLOR.cardBg, COLOR.border);
    tulis(label, x + 12, yKartu + 10, lebarKartu - 20, 7, COLOR.muted, true);
    tulis(nilai, x + 12, yKartu + 23, lebarKartu - 20, 17, COLOR.primaryFrom, true);
  });
  doc.y = yKartu + 50 + 16;

  // ---- tabel ----
  // Kolom: peringkat | siswa | try out Mandiri | Sekolah | Nasional | jumlah | rata-rata (nilai tertinggi/terendah ada di layar dan Excel)
  const kolom = { rank: X0 + 10, nama: X0 + 62, mandiri: X0 + CW - 262, sekolah: X0 + CW - 210, nasional: X0 + CW - 158, total: X0 + CW - 106, rata: X0 + CW - 58 };
  const lebarNama = kolom.mandiri - kolom.nama - 12;

  const gambarHeader = () => {
    const y = doc.y;
    doc.rect(X0, y, CW, TINGGI_HEADER_TABEL).fill("#f1f5f9");
    const judul = (t: string, x: number, lebar: number, rata: "left" | "right" | "center" = "left") => tulis(t, x, y + 8, lebar, 7, "#475569", true, rata);
    judul("PERINGKAT", kolom.rank - 8, 52, "center");
    judul("SISWA", kolom.nama, lebarNama);
    judul("MANDIRI", kolom.mandiri - 4, 48, "center");
    judul("SEKOLAH", kolom.sekolah - 4, 48, "center");
    judul("NASIONAL", kolom.nasional - 4, 48, "center");
    judul("JUMLAH", kolom.total - 4, 48, "center");
    judul("RATA-RATA", kolom.rata - 6, 56, "center");
    doc.x = X0;
    doc.y = y + TINGGI_HEADER_TABEL;
  };

  pastikanMuat(TINGGI_HEADER_TABEL + TINGGI_BARIS * 2);
  gambarHeader();

  if (data.baris.length === 0) {
    tulis("Belum ada siswa yang bisa diperingkat pada syarat ini.", X0 + 10, doc.y + 12, CW - 20, 9, COLOR.muted);
    doc.y += 36;
  }

  data.baris.forEach((b, i) => {
    if (pastikanMuat(TINGGI_BARIS + 4)) gambarHeader();
    const y = doc.y;
    if (i % 2 === 1) doc.rect(X0, y, CW, TINGGI_BARIS).fill("#f8fafc");

    const warna = WARNA_PERINGKAT[b.peringkat];
    if (warna) {
      doc.roundedRect(kolom.rank - 6, y + 4, 28, 19, 9.5).fill(warna.bg);
      tulis(String(b.peringkat), kolom.rank - 6, y + 9, 28, 9, warna.teks, true, "center");
    } else {
      tulis(String(b.peringkat), kolom.rank - 6, y + 9, 28, 9, COLOR.ink, true, "center");
    }

    doc.font(fonts.bold).fontSize(fonts.sz(9));
    const nama = muatDalam(doc, toText(b.nama), lebarNama - (b.alumni ? 44 : 0));
    tulis(nama, kolom.nama, y + 5, lebarNama, 9, COLOR.ink, true);
    if (b.alumni) {
      doc.font(fonts.bold).fontSize(fonts.sz(9));
      const geser = doc.widthOfString(nama) + 6;
      tulis("Alumni", kolom.nama + geser, y + 6.5, 40, 7, COLOR.muted);
    }
    if (b.nisn) tulis(`NISN ${b.nisn}`, kolom.nama, y + 16.5, lebarNama, 6.5, COLOR.faint);

    const jumlahJenis = (n: number, x: number) => tulis(String(n), x - 4, y + 9, 48, 9, n === 0 ? COLOR.faint : COLOR.body, false, "center");
    jumlahJenis(b.perJenis.mandiri, kolom.mandiri);
    jumlahJenis(b.perJenis.sekolah, kolom.sekolah);
    jumlahJenis(b.perJenis.nasional, kolom.nasional);
    tulis(String(b.jumlahTryOut), kolom.total - 4, y + 9, 48, 9, COLOR.ink, true, "center");
    const warnaSkor = (n: number) => COMPETENCY_TIER_HEX[competencyTier(n)];
    tulis(formatSkor(b.rataRata), kolom.rata - 6, y + 8.5, 56, 10, warnaSkor(b.rataRata), true, "center");

    doc.lineWidth(0.4).moveTo(X0, y + TINGGI_BARIS).lineTo(X0 + CW, y + TINGGI_BARIS).strokeColor(COLOR.border).stroke();
    doc.x = X0;
    doc.y = y + TINGGI_BARIS;
  });

  // ---- catatan cara menghitung ----
  const catatan =
    "Cara menghitung: tiap try out dinilai dari percobaan pertama siswa yang sudah selesai (mengulang tidak mengubah nilai). Peringkat memakai rata-rata semua try out yang dikerjakan; siswa dengan rata-rata sama (pada satu desimal) berbagi peringkat.";
  const tinggiCatatan = doc.font(fonts.regular).fontSize(fonts.sz(7.5)).heightOfString(catatan, { width: CW });
  pastikanMuat(tinggiCatatan + 22);
  const yCatatan = doc.y + 12;
  tulis(catatan, X0, yCatatan, CW, 7.5, COLOR.faint);
  doc.y = yCatatan + tinggiCatatan;

  // ---- nomor halaman ----
  const rentang = doc.bufferedPageRange();
  for (let i = 0; i < rentang.count; i++) {
    doc.switchToPage(rentang.start + i);
    nomorHalaman(doc, fonts, data.sekolah, i + 1, rentang.count);
  }
}
