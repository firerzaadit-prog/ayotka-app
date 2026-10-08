import "server-only";
import { competencyTier, COMPETENCY_TIER_HEX } from "@/lib/exam/competency-color";
import { LABEL_VONIS, type BarisIndikator, type KelompokIndikator } from "@/lib/indikator/daya-serap";
import { WARNA_VONIS, formatPersen, formatSelisih } from "@/lib/indikator/tampilan";
import { latexToPlainText } from "@/lib/pdf/latex-to-text";
import { COLOR, type PdfFonts } from "@/lib/pdf/pdf-umum";

/**
 * Gambar daya serap per indikator yang dipakai bersama rapor siswa dan laporan sekolah. Mengikuti aturan gambar PDF AyoTKA:
 * SETIAP teks dipasang di koordinat eksplisit dan tingginya diukur dulu (heightOfString) - tidak ada rantai continued atau
 * doc.y ambient - dan pindah halaman diputuskan SEBELUM menggambar sebuah blok, bukan di tengahnya. Pola lain pernah memicu
 * puluhan halaman kosong berantai (lihat catatan di drawWatermark, lib/pdf/rapor-renderer.ts).
 */
export const X0 = 48;

export function buatPenulis(doc: PDFKit.PDFDocument, fonts: PdfFonts) {
  const toText = (t: string) => latexToPlainText(t, { unicode: fonts.unicode });
  const batasBawah = () => doc.page.height - 62;
  const tinggi = (teks: string, ukuran: number, lebar: number, tebal = false) => {
    doc.font(tebal ? fonts.bold : fonts.regular).fontSize(fonts.sz(ukuran));
    return doc.heightOfString(teks, { width: lebar });
  };
  const tulis = (
    teks: string,
    x: number,
    y: number,
    lebar: number,
    ukuran: number,
    warna: string,
    tebal = false,
    align: "left" | "right" | "center" = "left",
  ) => {
    doc.font(tebal ? fonts.bold : fonts.regular).fontSize(fonts.sz(ukuran)).fillColor(warna).text(teks, x, y, { width: lebar, align });
  };
  /** Pindah halaman BILA blok setinggi `perlu` tidak muat; mengembalikan true bila pindah. */
  const pastikanMuat = (perlu: number) => {
    if (doc.y + perlu > batasBawah()) {
      doc.addPage();
      return true;
    }
    return false;
  };
  const dot = fonts.unicode ? "·" : "-";
  return { toText, tinggi, tulis, pastikanMuat, dot };
}

export type Penulis = ReturnType<typeof buatPenulis>;

/** Keterangan tambahan per baris di kolom kanan bawah (mis. "12 siswa"); null = tidak ada. */
export type KeteranganBaris<B extends BarisIndikator> = (b: B) => string | null;

export interface OpsiKelompok {
  /** Nama pembanding wilayah (laporan sekolah), dipakai bila kelompok punya rerata wilayah. */
  labelWilayah?: string;
}

/**
 * Kelompok indikator lengkap: kepala (nama, daya serap, batang, vonis dan rujukan nasional, rerata wilayah bila ada) lalu
 * baris tiap indikator (jalur hierarki, teks indikator, batang, persen, rerata nasional). `label[0]` adalah nama tingkat pertama.
 */
export function gambarKelompok<B extends BarisIndikator>(
  doc: PDFKit.PDFDocument,
  fonts: PdfFonts,
  contentWidth: number,
  label: string[],
  kelompok: KelompokIndikator<B>[],
  keterangan?: KeteranganBaris<B>,
  opsi?: OpsiKelompok,
) {
  const { toText, tinggi, tulis, pastikanMuat, dot } = buatPenulis(doc, fonts);
  const kolKiri = contentWidth - 150;
  const xKanan = X0 + contentWidth - 146;

  const ukurBaris = (b: B) => {
    const path = toText(b.level3 ? `${b.level2} ${dot} ${b.level3}` : b.level2);
    return { path, hPath: tinggi(path, 7, kolKiri), hInd: tinggi(toText(b.indikator), 8.5, kolKiri) };
  };

  const gambarBaris = (b: B) => {
    const { path, hPath, hInd } = ukurBaris(b);
    const ket = keterangan?.(b);
    // keterangan tambahan duduk di kolom kanan bawah: baris tidak boleh lebih pendek dari itu
    const h = Math.max(hPath + hInd + 9, ket ? 28 : 0);
    const y = doc.y;
    const warna = COMPETENCY_TIER_HEX[competencyTier(b.dayaSerap)];
    tulis(path, X0, y + 4, kolKiri, 7, COLOR.faint);
    tulis(toText(b.indikator), X0, y + 4 + hPath, kolKiri, 8.5, COLOR.body);
    doc.roundedRect(xKanan, y + 6, 56, 7, 3).fill(COLOR.cardBg);
    doc.roundedRect(xKanan, y + 6, Math.max(2, (56 * Math.min(100, b.dayaSerap)) / 100), 7, 3).fill(warna);
    tulis(formatPersen(b.dayaSerap, 0), xKanan + 58, y + 4, 32, 8, warna, true, "right");
    tulis(b.nasional === null ? "-" : `nas. ${formatPersen(b.nasional, 1)}`, xKanan + 92, y + 5, 54, 7, COLOR.muted);
    if (ket) tulis(ket, xKanan, y + 16, 146, 7, COLOR.faint);
    doc.lineWidth(0.4).moveTo(X0, y + h).lineTo(X0 + contentWidth, y + h).strokeColor(COLOR.border).stroke();
    doc.y = y + h;
  };

  for (const k of kelompok) {
    const nama = toText(`${label[0]}: ${k.nama}`);
    const hNama = tinggi(nama, 10, contentWidth - 60, true);
    const detailDasar =
      k.vonis === "data_kurang"
        ? `${LABEL_VONIS.data_kurang} ${dot} baru ${k.jmlSoal} soal (minimal 3 untuk dibandingkan)`
        : k.nasional !== null
          ? `${LABEL_VONIS[k.vonis]} ${dot} rerata nasional ${formatPersen(k.nasional, 1)} (${formatSelisih(k.selisih)})`
          : LABEL_VONIS[k.vonis];
    // Pembanding wilayah (hanya laporan sekolah) ditambahkan di baris detail yang sama; tingginya ikut diukur di bawah.
    const wilayah =
      typeof k.wilayah === "number"
        ? ` ${dot} ${opsi?.labelWilayah ?? "wilayah"} ${formatPersen(k.wilayah, 1)}${typeof k.selisihWilayah === "number" ? ` (${formatSelisih(k.selisihWilayah)})` : ""}`
        : "";
    const detail = detailDasar + wilayah;
    const hDetail = tinggi(detail, 8, contentWidth);
    const hKepala = hNama + 12 + hDetail + 8;
    const pertama = ukurBaris(k.baris[0]!);
    // kepala kelompok tidak boleh terpisah dari baris pertamanya
    pastikanMuat(hKepala + pertama.hPath + pertama.hInd + 12);

    const y = doc.y;
    const warna = COMPETENCY_TIER_HEX[competencyTier(k.dayaSerap)];
    tulis(nama, X0, y, contentWidth - 60, 10, COLOR.ink, true);
    tulis(formatPersen(k.dayaSerap, 0), X0 + contentWidth - 56, y, 56, 10, warna, true, "right");
    doc.roundedRect(X0, y + hNama + 3, contentWidth, 6, 3).fill(COLOR.cardBg);
    doc.roundedRect(X0, y + hNama + 3, Math.max(3, (contentWidth * Math.min(100, k.dayaSerap)) / 100), 6, 3).fill(warna);
    tulis(detail, X0, y + hNama + 12, contentWidth, 8, WARNA_VONIS[k.vonis], true);
    doc.y = y + hKepala;

    for (const b of k.baris) {
      const { hPath, hInd } = ukurBaris(b);
      if (pastikanMuat(Math.max(hPath + hInd + 9, keterangan?.(b) ? 28 : 0))) {
        tulis(toText(`${k.nama} (lanjutan)`), X0, doc.y, contentWidth, 8, COLOR.faint, true);
        doc.y += 14;
      }
      gambarBaris(b);
    }
    doc.y += 10;
  }
  doc.font(fonts.regular);
}

/** Daftar pendek bernomor (indikator terlemah/terkuat/prioritas): persen di kiri, teks indikator, lalu tingkat pertamanya. */
export function gambarDaftarFokus<B extends BarisIndikator>(
  doc: PDFKit.PDFDocument,
  fonts: PdfFonts,
  contentWidth: number,
  judul: string,
  deskripsi: string,
  baris: B[],
  kosong: string,
  keterangan?: KeteranganBaris<B>,
) {
  const { toText, tinggi, tulis, pastikanMuat } = buatPenulis(doc, fonts);
  const hJudul = tinggi(judul, 10, contentWidth, true);
  const hDesk = tinggi(deskripsi, 8, contentWidth);
  pastikanMuat(hJudul + hDesk + 40);
  const y = doc.y;
  tulis(judul, X0, y, contentWidth, 10, COLOR.ink, true);
  tulis(deskripsi, X0, y + hJudul + 2, contentWidth, 8, COLOR.muted);
  doc.y = y + hJudul + hDesk + 8;
  if (baris.length === 0) {
    tulis(kosong, X0, doc.y, contentWidth, 8.5, COLOR.body);
    doc.y += tinggi(kosong, 8.5, contentWidth) + 8;
    return;
  }
  for (const b of baris) {
    const teks = toText(b.indikator);
    const hTeks = tinggi(teks, 8.5, contentWidth - 40);
    const subteks = [b.level1, keterangan?.(b)].filter(Boolean).join(" - ");
    const hLevel = tinggi(toText(subteks), 7, contentWidth - 40);
    pastikanMuat(hTeks + hLevel + 8);
    const yb = doc.y;
    tulis(formatPersen(b.dayaSerap, 0), X0, yb, 34, 8.5, COMPETENCY_TIER_HEX[competencyTier(b.dayaSerap)], true);
    tulis(teks, X0 + 40, yb, contentWidth - 40, 8.5, COLOR.body);
    tulis(toText(subteks), X0 + 40, yb + hTeks, contentWidth - 40, 7, COLOR.faint);
    doc.y = yb + hTeks + hLevel + 6;
  }
  doc.y += 6;
}
