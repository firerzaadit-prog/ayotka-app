import "server-only";
import SVGtoPDF from "svg-to-pdfkit";
import { competencyTier, COMPETENCY_TIER_HEX, type CompetencyTier } from "@/lib/exam/competency-color";
import type { BarisHierarkiKompetensi } from "@/lib/exam/hierarki-kompetensi";
import { formatPersen } from "@/lib/indikator/tampilan";
import { COLOR, type PdfFonts } from "@/lib/pdf/pdf-umum";
import { X0, buatPenulis } from "@/lib/pdf/indikator-gambar";
import type { MediaSiap } from "@/lib/pdf/gambar-pdf";

/**
 * Komponen gambar rapor PDF (kepala, identitas, ringkasan nilai, tabel hierarki kompetensi, analisis Learning Analytics,
 * gambar soal). Mengikuti aturan gambar PDF AyoTKA (lihat catatan di lib/pdf/indikator-gambar.ts): SETIAP teks dipasang di
 * koordinat eksplisit dan tingginya diukur dulu (heightOfString), tidak ada rantai `continued` atau doc.y ambient, dan
 * pindah halaman diputuskan SEBELUM menggambar sebuah blok, bukan di tengahnya.
 */

/** Warna lencana skor (sama dengan lencana web: lib/exam/competency-color.ts menentukan tingkatnya). */
export const WARNA_LENCANA: Record<CompetencyTier, { bg: string; garis: string }> = {
  baik: { bg: "#ecfdf5", garis: "#a7f3d0" },
  cukup: { bg: "#fffbeb", garis: "#fde68a" },
  kurang: { bg: "#fef2f2", garis: "#fecaca" },
};

const lebarIsi = (doc: PDFKit.PDFDocument) => doc.page.width - 2 * X0;

/** Potong teks yang terlalu panjang (nama sekolah/paket yang tidak wajar) supaya tidak memenuhi satu halaman. */
export function potongTeks(teks: string, maks: number): string {
  const bersih = teks.replace(/\s+/g, " ").trim();
  return bersih.length > maks ? `${bersih.slice(0, maks - 1).trimEnd()}…` : bersih;
}

// ---------------------------------------------------------------------------------------------------------------------
// Kepala halaman pertama
// ---------------------------------------------------------------------------------------------------------------------

export const TINGGI_KEPALA = 118;

export type DataKepala = {
  logo: Buffer | null;
  /** Mis. "Try Out Nasional"; null = tanpa lencana jenis. */
  jenisLabel: string | null;
  /** Mis. "Matematika · SD"; null = tanpa. */
  subjudul: string | null;
  /** Mis. "12 Oktober 2026". */
  dicetak: string;
};

export function gambarKepala(doc: PDFKit.PDFDocument, fonts: PdfFonts, data: DataKepala): number {
  const { tulis } = buatPenulis(doc, fonts);
  const W = doc.page.width;
  const H = TINGGI_KEPALA;

  const gradien = doc.linearGradient(0, 0, W, H);
  gradien.stop(0, COLOR.primaryFrom).stop(1, COLOR.primaryTo);
  doc.rect(0, 0, W, H).fill(gradien);

  // Hiasan lingkaran tembus pandang, dipotong pada pita kepala supaya tidak keluar ke halaman.
  doc.save();
  doc.rect(0, 0, W, H).clip();
  doc.fillColor("#ffffff");
  doc.opacity(0.1).circle(W - 36, 18, 92).fill();
  doc.opacity(0.07).circle(W - 170, H + 6, 74).fill();
  doc.restore();

  let logoTerpasang = false;
  if (data.logo) {
    try {
      doc.image(data.logo, X0, 24, { fit: [36, 36] });
      logoTerpasang = true;
    } catch {
      // Format tidak didukung pdfkit: lanjut tanpa logo, jangan gagalkan seluruh rapor.
    }
  }
  // Tanpa logo (gagal diambil atau formatnya tak didukung) nama merek bergeser ke tepi kiri, tidak meninggalkan ruang kosong.
  const xMerek = logoTerpasang ? X0 + 46 : X0;
  tulis("AyoTKA", xMerek, 26, 220, 13, "#ffffff", true);
  tulis("Latihan Tes Kemampuan Akademik", xMerek, 43, 260, 7.5, "#c7d2fe");
  tulis("Rapor Hasil Ujian", X0, 72, 330, 22, "#ffffff", true);

  const kananX = W - X0 - 220;
  if (data.jenisLabel) {
    doc.font(fonts.bold).fontSize(fonts.sz(8));
    const teks = data.jenisLabel.toUpperCase();
    const lebar = Math.min(220, doc.widthOfString(teks) + 22);
    const x = W - X0 - lebar;
    doc.save();
    doc.opacity(0.22).roundedRect(x, 26, lebar, 19, 9.5).fill("#ffffff");
    doc.restore();
    tulis(teks, x, 31, lebar, 8, "#ffffff", true, "center");
  }
  if (data.subjudul) tulis(potongTeks(data.subjudul, 60), kananX, 56, 220, 9, "#e0e7ff", true, "right");
  tulis(`Dicetak ${data.dicetak}`, kananX, 72, 220, 7.5, "#c7d2fe", false, "right");

  doc.font(fonts.regular);
  return H;
}

// ---------------------------------------------------------------------------------------------------------------------
// Kartu identitas
// ---------------------------------------------------------------------------------------------------------------------

export type SelIdentitas = { label: string; nilai: string; sub?: string | null };

/**
 * Kartu identitas siswa dan ujian: dua kolom, tiap sel berisi label kecil, nilai tebal, dan keterangan tambahan bila ada.
 * `sel` diisi berurutan (kiri, kanan, kiri, kanan, ...). Mengembalikan y di bawah kartu.
 */
export function gambarKartuIdentitas(doc: PDFKit.PDFDocument, fonts: PdfFonts, y: number, sel: SelIdentitas[]): number {
  const { toText, tinggi, tulis } = buatPenulis(doc, fonts);
  const CW = lebarIsi(doc);
  const pad = 16;
  const jarakKolom = 18;
  const lebarKolom = (CW - 2 * pad - jarakKolom) / 2;

  const ukur = (s: SelIdentitas) => {
    const nilai = toText(potongTeks(s.nilai || "-", 160));
    const sub = s.sub ? toText(potongTeks(s.sub, 100)) : null;
    const hNilai = tinggi(nilai, 10.5, lebarKolom, true);
    const hSub = sub ? tinggi(sub, 8, lebarKolom) : 0;
    return { nilai, sub, hNilai, hSub, tinggi: 10 + hNilai + (sub ? 2 + hSub : 0) };
  };

  const baris: Array<{ kiri: SelIdentitas; kanan: SelIdentitas | null }> = [];
  for (let i = 0; i < sel.length; i += 2) baris.push({ kiri: sel[i]!, kanan: sel[i + 1] ?? null });
  const diukur = baris.map((b) => {
    const k = ukur(b.kiri);
    const r = b.kanan ? ukur(b.kanan) : null;
    return { k, r, tinggi: Math.max(k.tinggi, r?.tinggi ?? 0) + 11 };
  });
  const tinggiKartu = pad - 2 + diukur.reduce((n, b) => n + b.tinggi, 0) + 2;

  doc.roundedRect(X0, y, CW, tinggiKartu, 10).fillAndStroke("#ffffff", COLOR.border);

  let yy = y + pad - 2;
  diukur.forEach((b, i) => {
    const xKiri = X0 + pad;
    const xKanan = X0 + pad + lebarKolom + jarakKolom;
    const gambarSel = (s: SelIdentitas, x: number, u: ReturnType<typeof ukur>) => {
      tulis(s.label.toUpperCase(), x, yy, lebarKolom, 7, COLOR.muted, true);
      tulis(u.nilai, x, yy + 10, lebarKolom, 10.5, COLOR.ink, true);
      if (u.sub) tulis(u.sub, x, yy + 10 + u.hNilai + 2, lebarKolom, 8, COLOR.muted);
    };
    gambarSel(baris[i]!.kiri, xKiri, b.k);
    if (baris[i]!.kanan && b.r) gambarSel(baris[i]!.kanan!, xKanan, b.r);
    yy += b.tinggi;
    if (i < diukur.length - 1) {
      doc.lineWidth(0.4).moveTo(X0 + pad, yy - 5).lineTo(X0 + CW - pad, yy - 5).strokeColor(COLOR.border).stroke();
    }
  });

  doc.font(fonts.regular);
  return y + tinggiKartu;
}

// ---------------------------------------------------------------------------------------------------------------------
// Ringkasan nilai
// ---------------------------------------------------------------------------------------------------------------------

export type KotakRingkasan = {
  label: string;
  nilai: string;
  sub?: string | null;
  warna: string;
  /** Kotak pertama (nilai) diberi latar nila agar menonjol. */
  utama?: boolean;
};

export const TINGGI_KOTAK_RINGKASAN = 66;

/** Deretan kotak ringkasan (nilai akhir, jawaban benar, status) berlebar sama. Mengembalikan y di bawahnya. */
export function gambarRingkasan(doc: PDFKit.PDFDocument, fonts: PdfFonts, y: number, kotak: KotakRingkasan[]): number {
  const { toText, tulis } = buatPenulis(doc, fonts);
  const CW = lebarIsi(doc);
  const jarak = 10;
  const lebar = (CW - jarak * (kotak.length - 1)) / kotak.length;
  kotak.forEach((k, i) => {
    const x = X0 + i * (lebar + jarak);
    doc.roundedRect(x, y, lebar, TINGGI_KOTAK_RINGKASAN, 9).fillAndStroke(k.utama ? "#eef2ff" : COLOR.cardBg, k.utama ? "#c7d2fe" : COLOR.border);
    tulis(k.label.toUpperCase(), x + 12, y + 11, lebar - 20, 7, COLOR.muted, true);
    tulis(toText(k.nilai), x + 12, y + 23, lebar - 20, k.utama ? 24 : 16, k.warna, true);
    if (k.sub) tulis(toText(potongTeks(k.sub, 48)), x + 12, y + (k.utama ? 52 : 46), lebar - 20, 7.5, COLOR.muted);
  });
  doc.font(fonts.regular);
  return y + TINGGI_KOTAK_RINGKASAN;
}

// ---------------------------------------------------------------------------------------------------------------------
// Judul bagian
// ---------------------------------------------------------------------------------------------------------------------

/** Judul bagian bergaya sama di seluruh rapor: batang aksen nila di kiri, judul tebal, keterangan kecil di bawahnya. */
export function gambarJudulBagian(doc: PDFKit.PDFDocument, fonts: PdfFonts, judul: string, keterangan?: string | null) {
  const { toText, tinggi, tulis, pastikanMuat } = buatPenulis(doc, fonts);
  const CW = lebarIsi(doc);
  const ket = keterangan ? toText(keterangan) : null;
  const hKet = ket ? tinggi(ket, 8.5, CW - 12) : 0;
  pastikanMuat(46 + hKet);
  const y = doc.y;
  doc.roundedRect(X0, y + 1, 3.5, 15, 1.5).fill(COLOR.primaryFrom);
  tulis(judul, X0 + 11, y, CW - 11, 14, COLOR.ink, true);
  let akhir = y + 19;
  if (ket) {
    tulis(ket, X0 + 11, akhir, CW - 11, 8.5, COLOR.muted);
    akhir += hKet + 3;
  }
  doc.x = X0;
  doc.y = akhir + 6;
  doc.font(fonts.regular);
}

// ---------------------------------------------------------------------------------------------------------------------
// Tabel hierarki kompetensi (Peta Kompetensi: Elemen > Subelemen > Kompetensi), sama dengan tabel di halaman web
// ---------------------------------------------------------------------------------------------------------------------

const KOLOM_SKOR = 128;
const TINGGI_BARIS_MIN = 22;

export function gambarTabelHierarki(doc: PDFKit.PDFDocument, fonts: PdfFonts, baris: BarisHierarkiKompetensi[]) {
  const { toText, tinggi, tulis, pastikanMuat } = buatPenulis(doc, fonts);
  const CW = lebarIsi(doc);
  const xSkor = X0 + CW - KOLOM_SKOR;
  const panah = fonts.unicode ? "›" : ">";

  const gambarHeader = () => {
    const y = doc.y;
    doc.rect(X0, y, CW, TINGGI_BARIS_MIN).fill("#f1f5f9");
    doc.rect(xSkor, y, KOLOM_SKOR, TINGGI_BARIS_MIN).fill("#e0e7ff");
    tulis("HIERARKI", X0 + 10, y + 7.5, 200, 7.5, "#475569", true);
    tulis("SKOR KAMU", xSkor, y + 7.5, KOLOM_SKOR - 10, 7.5, "#3730a3", true, "right");
    doc.x = X0;
    doc.y = y + TINGGI_BARIS_MIN;
  };

  pastikanMuat(TINGGI_BARIS_MIN + 70);
  gambarHeader();

  for (const b of baris) {
    const indentasi = b.level === 1 ? 10 : b.level === 2 ? 24 : 38;
    const ukuran = b.level === 1 ? 10 : b.level === 2 ? 9 : 8.5;
    const tebal = b.level !== 3;
    const teks = toText(b.level === 1 ? `${b.nomor ?? ""}${b.nomor ? ". " : ""}${b.teks}` : `${panah} ${b.teks}`);
    const lebarTeks = CW - KOLOM_SKOR - indentasi - 8;
    const hTeks = tinggi(teks, ukuran, lebarTeks, tebal);
    const h = Math.max(TINGGI_BARIS_MIN, hTeks + 10);

    // Baris tingkat 1 tidak boleh tertinggal sendirian di dasar halaman: harus muat bersama satu baris sesudahnya.
    if (pastikanMuat(h + (b.level === 1 ? TINGGI_BARIS_MIN + 6 : 0))) gambarHeader();

    const y = doc.y;
    if (b.level === 1) doc.rect(X0, y, CW, h).fill("#f8fafc");
    doc.rect(xSkor, y, KOLOM_SKOR, h).fill(b.level === 1 ? "#eef2ff" : "#f5f7ff");
    tulis(teks, X0 + indentasi, y + (h - hTeks) / 2, lebarTeks, ukuran, b.level === 3 ? COLOR.body : COLOR.ink, tebal);

    if (b.persentase == null) {
      tulis("–", xSkor, y + (h - 9) / 2, KOLOM_SKOR - 12, 9, COLOR.faint, false, "right");
    } else {
      const tingkat = competencyTier(b.persentase);
      const warna = COMPETENCY_TIER_HEX[tingkat];
      const teksPersen = formatPersen(b.persentase, 0);
      doc.font(fonts.bold).fontSize(fonts.sz(8));
      const lebarLencana = Math.max(36, doc.widthOfString(teksPersen) + 16);
      const xLencana = X0 + CW - 10 - lebarLencana;
      const yLencana = y + (h - 15) / 2;
      doc.roundedRect(xLencana, yLencana, lebarLencana, 15, 4).fillAndStroke(WARNA_LENCANA[tingkat].bg, WARNA_LENCANA[tingkat].garis);
      tulis(teksPersen, xLencana, yLencana + 3.5, lebarLencana, 8, warna, true, "center");
      if (b.jmlSoal > 0) {
        tulis(`${b.jmlBenar}/${b.jmlSoal} benar`, xSkor, yLencana + 4, KOLOM_SKOR - 10 - lebarLencana - 6, 7, COLOR.muted, false, "right");
      }
    }
    doc.lineWidth(0.4).moveTo(X0, y + h).lineTo(X0 + CW, y + h).strokeColor(COLOR.border).stroke();
    doc.x = X0;
    doc.y = y + h;
  }
  doc.font(fonts.regular);
  doc.y += 8;
}

/** Legenda warna tiga tingkat (sama dengan web): satu baris, tiap bagian di koordinat sendiri. */
export function gambarLegendaTingkat(doc: PDFKit.PDFDocument, fonts: PdfFonts) {
  const { tulis, pastikanMuat } = buatPenulis(doc, fonts);
  pastikanMuat(20);
  const titik = fonts.unicode ? "●" : "•";
  const gte = fonts.unicode ? "≥" : ">=";
  const y = doc.y;
  const bagian: Array<[string, CompetencyTier, number]> = [
    [`${titik} Baik (${gte}70%)`, "baik", 0],
    [`${titik} Cukup (50-69%)`, "cukup", 110],
    [`${titik} Perlu latihan (<50%)`, "kurang", 236],
  ];
  for (const [teks, tingkat, dx] of bagian) tulis(teks, X0 + dx, y, 200, 7.5, COMPETENCY_TIER_HEX[tingkat]);
  doc.x = X0;
  doc.y = y + 18;
}

// ---------------------------------------------------------------------------------------------------------------------
// Analisis Learning Analytics
// ---------------------------------------------------------------------------------------------------------------------

export type BlokAnalisis = { judul: string; warna: string; paragraf?: string[]; daftar?: string[] };

/**
 * Satu blok analisis (Ringkasan, Kelebihan, Kekurangan, Rekomendasi) dengan batang aksen berwarna di kiri. Blok yang muat
 * dalam satu halaman tidak dipotong antar halaman; blok yang lebih panjang (jarang) dialirkan tanpa batang aksen.
 */
export function gambarBlokAnalisis(doc: PDFKit.PDFDocument, fonts: PdfFonts, blok: BlokAnalisis) {
  const { toText, tinggi, pastikanMuat } = buatPenulis(doc, fonts);
  const CW = lebarIsi(doc);
  const x = X0 + 13;
  const lebar = CW - 13;
  const butir = fonts.unicode ? "•" : "-";

  const bagian: string[] = [...(blok.paragraf ?? []).map((p) => toText(p)), ...(blok.daftar ?? []).map((d) => toText(`${butir}  ${d}`))];
  const tingginya = bagian.map((t) => tinggi(t, 9.5, lebar));
  const total = 14 + tingginya.reduce((n, h) => n + h + 4, 0) + 4;
  const kapasitas = doc.page.height - 62 - 48;
  const muatSatuHalaman = total <= kapasitas * 0.9;
  pastikanMuat(muatSatuHalaman ? total : 70);

  const y = doc.y;
  if (muatSatuHalaman) doc.roundedRect(X0, y, 3.5, total - 6, 1.5).fill(blok.warna);
  doc.font(fonts.bold).fontSize(fonts.sz(10)).fillColor(blok.warna).text(blok.judul, x, y, { width: lebar });
  let yy = y + 15;
  doc.font(fonts.regular).fontSize(fonts.sz(9.5)).fillColor(COLOR.body);
  bagian.forEach((teks, i) => {
    // Daftar tidak dibenarkan rata kiri-kanan (butir pendek tampak renggang); paragraf dibenarkan seperti rapor sebelumnya.
    const adalahButir = i >= (blok.paragraf?.length ?? 0);
    doc.text(teks, x, yy, { width: lebar, align: adalahButir ? "left" : "justify" });
    yy += tingginya[i]! + 4;
  });
  doc.x = X0;
  doc.y = Math.max(yy, y + (muatSatuHalaman ? total - 6 : 0)) + 8;
  doc.font(fonts.regular);
}

// ---------------------------------------------------------------------------------------------------------------------
// Gambar soal (diagram SVG dan foto)
// ---------------------------------------------------------------------------------------------------------------------

const MAKS_LEBAR_GAMBAR = 0.64;
const MAKS_TINGGI_GAMBAR = 190;
/** Gambar kecil boleh diperbesar sedikit supaya terbaca, tidak lebih. */
const MAKS_PERBESARAN = 1.25;

/** Ukuran alami SVG dari viewBox atau atribut width/height (px); bawaan 300x200 bila tak terbaca. */
export function ukuranSvg(svg: string): { lebar: number; tinggi: number } {
  const kepala = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
  const vb = /viewBox\s*=\s*["']\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)\s*["']/i.exec(kepala);
  if (vb) {
    const w = Number(vb[3]);
    const h = Number(vb[4]);
    if (w > 0 && h > 0) return { lebar: w, tinggi: h };
  }
  const w = Number(/\bwidth\s*=\s*["']\s*([\d.]+)/i.exec(kepala)?.[1]);
  const h = Number(/\bheight\s*=\s*["']\s*([\d.]+)/i.exec(kepala)?.[1]);
  if (w > 0 && h > 0) return { lebar: w, tinggi: h };
  return { lebar: 300, tinggi: 200 };
}

/** Skala agar ukuran alami (lebar x tinggi) muat di kotak maksimum tanpa diperbesar melebihi 1,25x. */
export function muatkanGambar(lebar: number, tinggi: number, maksLebar: number, maksTinggi: number): { w: number; h: number } {
  if (!(lebar > 0) || !(tinggi > 0)) return { w: maksLebar, h: maksTinggi };
  const skala = Math.min(maksLebar / lebar, maksTinggi / tinggi, MAKS_PERBESARAN);
  return { w: lebar * skala, h: tinggi * skala };
}

/**
 * Satu gambar soal dengan labelnya, di tengah halaman. Gambar yang tak muat di sisa halaman dipindah ke halaman berikut.
 * Diagram SVG digambar sebagai vektor (teks memakai font rapor); gagal digambar = keterangan singkat, tidak melempar.
 */
export function gambarMedia(doc: PDFKit.PDFDocument, fonts: PdfFonts, media: MediaSiap) {
  const { tulis, pastikanMuat } = buatPenulis(doc, fonts);
  const CW = lebarIsi(doc);
  const maksLebar = CW * MAKS_LEBAR_GAMBAR;

  if (media.jenis === "gagal") {
    pastikanMuat(24);
    const yKeterangan = doc.y;
    tulis(`[${media.label}: gambar tidak dapat dimuat di rapor ini, lihat di aplikasi]`, X0, yKeterangan, CW, 8, COLOR.faint);
    doc.y = yKeterangan + 16;
    return;
  }

  let ukuran: { w: number; h: number };
  let raster: { buffer: Buffer } | null = null;
  if (media.jenis === "raster") {
    try {
      // openImage ada di PDFKit (membaca ukuran gambar) tetapi tidak ada di tipenya.
      const img = (doc as unknown as { openImage(sumber: Buffer): { width: number; height: number } }).openImage(media.buffer);
      ukuran = muatkanGambar(img.width, img.height, maksLebar, MAKS_TINGGI_GAMBAR);
      raster = { buffer: media.buffer };
    } catch {
      pastikanMuat(24);
      const yKeterangan = doc.y;
      tulis(`[${media.label}: format gambar tidak didukung]`, X0, yKeterangan, CW, 8, COLOR.faint);
      doc.y = yKeterangan + 16;
      return;
    }
  } else {
    const alami = ukuranSvg(media.svg);
    ukuran = muatkanGambar(alami.lebar, alami.tinggi, maksLebar, MAKS_TINGGI_GAMBAR);
  }

  pastikanMuat(ukuran.h + 24);
  const y = doc.y;
  tulis(media.label, X0, y, CW, 7.5, COLOR.faint, false, "center");
  const x = X0 + (CW - ukuran.w) / 2;
  const yGambar = y + 12;
  doc.roundedRect(x - 4, yGambar - 4, ukuran.w + 8, ukuran.h + 8, 6).lineWidth(0.5).strokeColor(COLOR.border).stroke();
  try {
    if (raster) {
      doc.image(raster.buffer, x, yGambar, { width: ukuran.w, height: ukuran.h });
    } else if (media.jenis === "svg") {
      SVGtoPDF(doc, media.svg, x, yGambar, {
        width: ukuran.w,
        height: ukuran.h,
        assumePt: true,
        preserveAspectRatio: "xMidYMid meet",
        fontCallback: (_keluarga: string, tebal: boolean) => (tebal ? fonts.bold : fonts.regular),
        // Gambar di dalam SVG tidak pernah dibaca dari disk atau jaringan: hanya data URI gambar.
        imageCallback: (tautan: string) => (/^data:image\//i.test(tautan) ? tautan.replace(/\s+/g, "") : ""),
        warningCallback: () => undefined,
      });
    }
  } catch {
    tulis(`[${media.label}: gagal digambar]`, x, yGambar + ukuran.h / 2 - 5, ukuran.w, 8, COLOR.faint, false, "center");
  }
  doc.font(fonts.regular).fillColor(COLOR.body);
  doc.x = X0;
  doc.y = yGambar + ukuran.h + 12;
}
