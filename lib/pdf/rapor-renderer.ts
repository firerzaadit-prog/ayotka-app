import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { buildHasil } from "@/lib/exam/hasil";
import { latexToPlainText } from "@/lib/pdf/latex-to-text";
import { competencyTier, COMPETENCY_TIER_HEX } from "@/lib/exam/competency-color";

type Hasil = Awaited<ReturnType<typeof buildHasil>>;
type AiAnalysisDetail = {
  ringkasan?: string;
  petaKompetensi?: { kode: string; narasi: string }[];
  kelebihanSiswa?: string;
  kekuranganSiswa?: string;
  levelKognitif?: string;
  polaKesalahan?: string;
  rekomendasi?: string[];
} | null;

const COLOR = {
  primaryFrom: "#4f46e5",
  primaryTo: "#7c3aed",
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  border: "#e2e8f0",
  cardBg: "#f8fafc",
  success: "#059669",
  successBg: "#ecfdf5",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
  warnText: "#b45309",
  warnBg: "#fffbeb",
} as const;

const FORMAT_LABEL: Record<string, string> = {
  pg: "PG",
  pg_kompleks: "PG Kompleks",
  pg_kategori: "PG Kategori",
};

/**
 * Font PDF. Font standar pdfkit (Helvetica) cuma mendukung WinAnsi, jadi
 * simbol matematika (π ≤ ≥ √ ∠ ✓ ●) dan superskrip/subskrip (x², L₁) tampil
 * sebagai karakter acak (mis. legenda "%Ï Baik ("e70%)"). DejaVu Sans
 * (lib/pdf/fonts, lisensi bebas) mencakup semuanya - dimuat dari disk sekali
 * lalu di-cache. Kalau file font tidak ikut ter-bundle di server (mis.
 * konfigurasi tracing salah), jatuh kembali ke Helvetica + konversi teks
 * mode aman (lihat lib/pdf/latex-to-text.ts) supaya rapor tetap terunduh,
 * bukan gagal total - tapi dicatat di log supaya ketahuan.
 */
type PdfFonts = {
  regular: string;
  bold: string;
  /** true kalau font Unicode berhasil dimuat. */
  unicode: boolean;
  /** Skala ukuran huruf: DejaVu ~7% lebih lebar dari Helvetica di ukuran nominal yang sama. */
  sz: (n: number) => number;
};

let fontBuffers: { regular: Buffer; bold: Buffer } | null | undefined;

function loadFontBuffers(): { regular: Buffer; bold: Buffer } | null {
  if (fontBuffers !== undefined) return fontBuffers;
  try {
    const dir = path.join(process.cwd(), "lib", "pdf", "fonts");
    fontBuffers = {
      regular: fs.readFileSync(path.join(dir, "DejaVuSans.ttf")),
      bold: fs.readFileSync(path.join(dir, "DejaVuSans-Bold.ttf")),
    };
  } catch (err) {
    console.warn("[rapor-pdf] font DejaVu tidak ditemukan, memakai Helvetica (simbol matematika akan disederhanakan):", err);
    fontBuffers = null;
  }
  return fontBuffers;
}

function setupFonts(doc: PDFKit.PDFDocument): PdfFonts {
  const buffers = loadFontBuffers();
  if (buffers) {
    try {
      doc.registerFont("Body", buffers.regular);
      doc.registerFont("Body-Bold", buffers.bold);
      return { regular: "Body", bold: "Body-Bold", unicode: true, sz: (n) => Math.round(n * 0.93 * 10) / 10 };
    } catch (err) {
      console.warn("[rapor-pdf] gagal mendaftarkan font DejaVu, memakai Helvetica:", err);
    }
  }
  return { regular: "Helvetica", bold: "Helvetica-Bold", unicode: false, sz: (n) => n };
}

export async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

type Align = "center" | "justify" | "left" | "right";

/**
 * Pecah teks di sekitar tag perataan ala editor soal ([center]...[/center],
 * lihat components/soal/question-form.tsx) SEBELUM dipecah di gambar. Versi
 * lama memecah di gambar dulu, sehingga "[center]" tertinggal di potongan
 * sebelum gambar dan "[/center]" di potongan sesudahnya - tak ada potongan
 * yang memuat pasangan lengkap, jadi kedua tag bocor mentah ke rapor.
 * Tag tunggal tanpa pasangan dibuang (jaring pengaman).
 */
function splitAlignment(text: string): { text: string; align?: Align }[] {
  const segments: { text: string; align?: Align }[] = [];
  const regex = /\[(left|center|right|justify)\]([\s\S]*?)\[\/\1\]/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index) });
    segments.push({ text: m[2]!, align: m[1]!.toLowerCase() as Align });
    last = regex.lastIndex;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments.map((s) => ({ ...s, text: s.text.replace(/\[\/?(left|center|right|justify)\]/gi, "") }));
}

async function renderTextWithImages(
  doc: PDFKit.PDFDocument,
  text: string | null | undefined,
  options: { width: number; align?: Align; color?: string },
  fonts: PdfFonts,
) {
  if (!text) return;
  for (const segment of splitAlignment(text)) {
    await renderSegmentWithImages(
      doc,
      segment.text,
      { ...options, align: segment.align ?? options.align },
      fonts,
    );
  }
}

async function renderSegmentWithImages(
  doc: PDFKit.PDFDocument,
  text: string,
  options: { width: number; align?: Align; color?: string },
  fonts: PdfFonts,
) {
  doc.fillColor(options.color ?? COLOR.body);
  const toText = (t: string) => latexToPlainText(t, { unicode: fonts.unicode });
  const regex = /!\[.*?\]\((.*?)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const preText = text.substring(lastIndex, match.index);
    if (preText.trim()) {
      doc.text(toText(preText), options);
      doc.moveDown(0.4);
    }

    const url = match[1] as string;
    const buffer = await fetchImageBuffer(url);
    if (buffer) {
      // doc.image() tidak auto-pindah halaman seperti .text() - kalau tidak
      // cukup ruang, gambar digambar apa adanya lalu terpotong rata batas
      // bawah halaman. Cek dulu terhadap tinggi maksimum yang dipakai fit[].
      const maxImageHeight = 250;
      if (doc.y + maxImageHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
      doc.image(buffer, { fit: [options.width, maxImageHeight], align: "center" });
      doc.moveDown(0.4);
    } else {
      doc.fillColor(COLOR.danger).text("[Gambar gagal dimuat]", options);
      doc.fillColor(options.color ?? COLOR.body);
      doc.moveDown(0.4);
    }

    lastIndex = regex.lastIndex;
  }

  const postText = text.substring(lastIndex);
  if (postText.trim()) {
    doc.text(toText(postText), options);
    doc.moveDown(0.4);
  }
}

/** Badge kecil bergaya pill (mis. "Benar"/"Salah") - mengembalikan lebar yang dipakai. */
function drawBadge(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  variant: "success" | "danger",
  fonts: PdfFonts,
): number {
  const color = variant === "success" ? COLOR.success : COLOR.danger;
  const bg = variant === "success" ? COLOR.successBg : COLOR.dangerBg;
  doc.fontSize(fonts.sz(9)).font(fonts.bold);
  const width = doc.widthOfString(text) + 16;
  doc.roundedRect(x, y, width, 17, 8.5).fill(bg);
  doc.fillColor(color).text(text, x + 8, y + 4, { lineBreak: false });
  doc.font(fonts.regular);
  return width;
}

type MateriScoreRow = { materiNama: string; jmlBenar: number; jmlSoal: number; persentase: number };

function competencyChartHeight(count: number): number {
  return count * 24 + 18;
}

/**
 * Grafik batang horizontal 3 warna per Materi (gridline + sumbu 0-100%) -
 * Bagian 8.7 brief. Ambang warna SAMA persis dengan versi web (lihat
 * lib/exam/competency-color.ts) supaya siswa tidak melihat warna berbeda
 * untuk persentase yang sama di dua tempat. Digambar sebagai satu blok atom
 * (bukan loop per-baris dengan addPage() sendiri-sendiri) dan setiap teks
 * dipasang di koordinat eksplisit - tidak ada continued-chain atau
 * ambil-doc.y-ambient sama sekali. Pola itu (lihat catatan di drawWatermark)
 * pernah menyebabkan kursor pdfkit nyangkut di posisi tidak valid lalu
 * memicu puluhan halaman kosong berantai begitu ada baris yang perlu pindah
 * halaman - jadi dihindari total di sini.
 */
function drawCompetencyChart(
  doc: PDFKit.PDFDocument,
  scores: MateriScoreRow[],
  x: number,
  y: number,
  width: number,
  fonts: PdfFonts,
): number {
  const labelW = 165;
  const pctLabelW = 40;
  const barX = x + labelW + 8;
  const barW = width - labelW - 8 - pctLabelW;
  const rowH = 24;
  const barH = 13;
  const chartH = scores.length * rowH;

  doc.lineWidth(0.5);
  for (const pct of [0, 25, 50, 75, 100]) {
    const gx = barX + (barW * pct) / 100;
    doc.moveTo(gx, y).lineTo(gx, y + chartH).strokeColor(COLOR.border).stroke();
  }

  scores.forEach((s, i) => {
    const rowY = y + i * rowH;
    const accent = COMPETENCY_TIER_HEX[competencyTier(s.persentase)];
    // Font Unicode lebih lebar dari Helvetica - batas karakter label dikurangi
    // supaya label panjang tidak menabrak batang di sebelahnya.
    const maxLabel = fonts.unicode ? 27 : 32;
    const label = s.materiNama.length > maxLabel ? `${s.materiNama.slice(0, maxLabel - 1)}…` : s.materiNama;

    doc.fontSize(fonts.sz(8.5)).font(fonts.bold).fillColor(COLOR.ink)
      .text(label, x, rowY + 3, { width: labelW, lineBreak: false });

    const barY = rowY + 3;
    doc.roundedRect(barX, barY, barW, barH, 3).fill(COLOR.cardBg);
    const fillW = Math.max(3, (barW * Math.min(100, s.persentase)) / 100);
    doc.roundedRect(barX, barY, fillW, barH, 3).fill(accent);

    doc.fontSize(fonts.sz(8)).font(fonts.bold).fillColor(accent)
      .text(`${s.persentase.toFixed(0)}%`, barX + barW + 6, barY + 2, { width: pctLabelW, lineBreak: false });
  });
  doc.font(fonts.regular);

  const axisY = y + chartH + 4;
  doc.fontSize(fonts.sz(7)).fillColor(COLOR.faint);
  for (const pct of [0, 25, 50, 75, 100]) {
    const gx = barX + (barW * pct) / 100;
    doc.text(`${pct}%`, gx - 10, axisY, { width: 20, align: "center", lineBreak: false });
  }

  return axisY + 16;
}

/** Watermark identitas siswa diulang di seluruh halaman - jejak anti-bocor
 * dokumen (rapor PDF adalah artefak paling gampang disebarluaskan, jadi versi
 * cetak/download ini justru paling butuh proteksi ini, sama seperti yang
 * sudah dipasang di halaman web hasil - Tiket 5.9). */
function drawWatermark(doc: PDFKit.PDFDocument, label: string, fonts: PdfFonts) {
  // doc.save()/restore() cuma menyimpan graphics state (rotasi, opacity, dst) -
  // BUKAN posisi kursor doc.x/doc.y. Tiap doc.text() dalam loop ubin di bawah
  // ikut menggeser doc.x/doc.y ke titik ubin terakhir (jauh di luar halaman,
  // dalam ruang koordinat yang sudah dirotasi). Watermark ini digambar ulang
  // tiap ada halaman baru (event "pageAdded") - kalau posisi kursor yang rusak
  // ini dibiarkan, panggilan .text() berikutnya di konten asli mengira halaman
  // sudah meluap dan menambah halaman baru lagi, yang memicu watermark digambar
  // ulang lagi, dst - satu blok konten bisa menghasilkan puluhan halaman kosong.
  const savedX = doc.x;
  const savedY = doc.y;
  doc.save();
  doc.rotate(-28, { origin: [doc.page.width / 2, doc.page.height / 2] });
  // Font watermark = font isi (bukan Helvetica tetap): doc.font() bukan bagian
  // dari save()/restore(), jadi font yang dipakai di sini menjadi font aktif
  // untuk teks pertama di halaman baru - harus konsisten dengan isi rapor.
  doc.fontSize(9).font(fonts.regular).fillColor(COLOR.ink).opacity(0.06);
  const tileW = 190;
  const tileH = 95;
  const pad = 160;
  for (let ty = -pad; ty < doc.page.height + pad; ty += tileH) {
    for (let tx = -pad; tx < doc.page.width + pad; tx += tileW) {
      doc.text(label, tx, ty, { lineBreak: false });
    }
  }
  doc.opacity(1);
  doc.restore();
  doc.x = savedX;
  doc.y = savedY;
}

function drawPageNumber(doc: PDFKit.PDFDocument, page: number) {
  // Teks ini sengaja diletakkan di dalam zona margin bawah (30pt dari tepi).
  // pdfkit menganggap posisi di dalam margin sebagai "konten meluap" dan diam-diam
  // menambah halaman baru kosong kalau margins.bottom tidak dinolkan dulu -
  // trik standar pdfkit untuk header/footer di area margin.
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.fontSize(8).fillColor(COLOR.faint)
    .text(`AyoTKA · Rapor Hasil Ujian · Halaman ${page}`, 0, doc.page.height - 30, {
      width: doc.page.width,
      align: "center",
    });
  doc.page.margins.bottom = originalBottomMargin;
}

/**
 * Render seluruh isi rapor ke PDFDocument yang sudah dibuat pemanggil (route
 * yang menangani auth/DB, atau skrip uji visual dengan data tiruan). Dipisah
 * dari route supaya bisa diuji dengan data mock tanpa perlu DB/sesi asli.
 */
export async function renderRaporPdf(
  doc: PDFKit.PDFDocument,
  hasil: Hasil,
  aiAnalysis: { detailJson: AiAnalysisDetail } | null,
  logoBuffer: Buffer | null,
) {
  const contentWidth = doc.page.width - 96;
  const watermarkLabel = `${hasil.siswa.nama} · ${hasil.siswa.idSamar}`;
  const fonts = setupFonts(doc);
  doc.font(fonts.regular);

  drawWatermark(doc, watermarkLabel, fonts);
  doc.on("pageAdded", () => {
    drawWatermark(doc, watermarkLabel, fonts);
  });

  // --- HEADER: gradien indigo->violet, logo, judul, identitas ---
  const headerH = 132;
  const gradient = doc.linearGradient(0, 0, doc.page.width, headerH);
  gradient.stop(0, COLOR.primaryFrom).stop(1, COLOR.primaryTo);
  doc.rect(0, 0, doc.page.width, headerH).fill(gradient);

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 48, 34, { width: 34, height: 34, fit: [34, 34] });
    } catch {
      // Format tidak didukung pdfkit - lanjut tanpa logo, jangan gagalkan seluruh rapor.
    }
  }
  doc.fillColor("#ffffff").fontSize(fonts.sz(11)).font(fonts.bold).text("AyoTKA", 90, 40);
  doc.fillColor("#ffffff").fontSize(fonts.sz(20)).font(fonts.bold).text("Rapor Hasil Ujian", 48, 62);
  doc.font(fonts.regular);

  doc.fontSize(fonts.sz(10)).fillColor("#e0e7ff").text(hasil.package.nama, 48, 48, { align: "right", width: contentWidth });
  doc.fillColor("#c7d2fe").text(hasil.siswa.nama, { align: "right", width: contentWidth });
  doc.fillColor("#c7d2fe").fontSize(fonts.sz(9)).text(hasil.siswa.idSamar, { align: "right", width: contentWidth });

  doc.y = headerH + 24;

  // --- RINGKASAN NILAI ---
  const summaryY = doc.y;
  const summaryH = 74;
  doc.roundedRect(48, summaryY, contentWidth, summaryH, 10).fill(COLOR.cardBg).stroke(COLOR.border);

  doc.fontSize(fonts.sz(9)).fillColor(COLOR.muted).text("NILAI AKHIR", 68, summaryY + 16);
  doc.fontSize(fonts.sz(30)).font(fonts.bold).fillColor(COLOR.primaryFrom)
    .text(hasil.attempt.skorAkhir?.toFixed(1) ?? "-", 68, summaryY + 30);
  doc.font(fonts.regular);

  const totalBenar = hasil.perSoal.filter((s) => (s.skor ?? 0) >= s.skorMaks).length;
  const statCol2X = 68 + 150;
  doc.fontSize(fonts.sz(9)).fillColor(COLOR.muted).text("JAWABAN BENAR", statCol2X, summaryY + 16);
  doc.fontSize(fonts.sz(16)).font(fonts.bold).fillColor(COLOR.ink)
    .text(`${totalBenar} / ${hasil.perSoal.length}`, statCol2X, summaryY + 32);
  doc.font(fonts.regular);

  const statCol3X = statCol2X + 150;
  const statusLabel =
    hasil.attempt.status === "kedaluwarsa" ? "Waktu habis (auto-submit)" : "Selesai";
  doc.fontSize(fonts.sz(9)).fillColor(COLOR.muted).text("STATUS", statCol3X, summaryY + 16);
  doc.fontSize(fonts.sz(11)).font(fonts.bold).fillColor(COLOR.ink).text(statusLabel, statCol3X, summaryY + 34, {
    width: contentWidth - (statCol3X - 48) - 20,
  });
  doc.font(fonts.regular);

  doc.y = summaryY + summaryH + 10;

  // "Nilai Akhir" adalah skor tertimbang (tiap soal punya bobot sendiri,
  // penjumlahan skor/skor-maks × 100 - lihat lib/exam/scoring.ts), BUKAN
  // sekadar persentase jumlah-benar/total-soal seperti stat "Jawaban Benar"
  // di sebelahnya. Kalau bobot antar soal seragam kedua angka ini otomatis
  // sama, tapi kalau tidak, angkanya bisa terpaut cukup jauh dan terlihat
  // seperti salah hitung padahal bukan - beri catatan hanya saat itu terjadi.
  const naivePct = hasil.perSoal.length > 0 ? (totalBenar / hasil.perSoal.length) * 100 : 0;
  if (Math.abs(naivePct - (hasil.attempt.skorAkhir ?? 0)) > 1) {
    doc.fontSize(fonts.sz(8)).fillColor(COLOR.faint).text(
      "Catatan: Nilai Akhir adalah skor tertimbang (tiap soal bisa punya bobot berbeda), bukan sekadar persentase jumlah soal benar.",
      48,
      doc.y,
      { width: contentWidth },
    );
    doc.moveDown(0.6);
  }
  doc.moveDown(0.8);

  // --- PETA KOMPETENSI ---
  if (hasil.materiScores.length > 0) {
    const chartH = competencyChartHeight(hasil.materiScores.length);
    // Chart digambar sebagai satu blok - kalau tidak cukup muat di sisa
    // halaman ini, pindah halaman DULU (bukan di tengah-tengah menggambar).
    if (doc.y + 44 + chartH > doc.page.height - 48) doc.addPage();

    doc.fontSize(fonts.sz(14)).font(fonts.bold).fillColor(COLOR.ink).text("Peta Kompetensi", 48, doc.y);
    doc.font(fonts.regular);
    doc.moveDown(0.8);

    doc.y = drawCompetencyChart(doc, hasil.materiScores, 48, doc.y, contentWidth, fonts);

    // Legenda: "●" dan "≥" tidak ada di font default (WinAnsi) - dulu tampil
    // sebagai "%Ï Baik ("e70%)". Di mode cadangan diganti padanan ASCII.
    const dot = fonts.unicode ? "●" : "•";
    const gte = fonts.unicode ? "≥" : ">=";
    const legendY = doc.y;
    doc.fontSize(fonts.sz(7.5)).fillColor(COMPETENCY_TIER_HEX.baik).text(`${dot} Baik (${gte}70%)`, 48, legendY, { continued: true, lineBreak: false });
    doc.fillColor(COMPETENCY_TIER_HEX.cukup).text(`   ${dot} Cukup (50-69%)`, { continued: true, lineBreak: false });
    doc.fillColor(COMPETENCY_TIER_HEX.kurang).text(`   ${dot} Perlu latihan (<50%)`, { lineBreak: false });
    doc.y = legendY + 14;
    doc.moveDown(0.6);
  }

  // --- ANALISIS AI ---
  const analysis = aiAnalysis?.detailJson ?? null;
  if (analysis) {
    if (doc.y > doc.page.height - 220) doc.addPage();

    doc.fontSize(fonts.sz(14)).font(fonts.bold).fillColor(COLOR.ink).text("Analisis AI", 48, doc.y);
    doc.font(fonts.regular);
    doc.moveDown(0.4);

    const accentY = doc.y;
    doc.rect(48, accentY, contentWidth, 3).fill(COLOR.primaryFrom);
    doc.y = accentY + 14;

    doc.fontSize(fonts.sz(10.5)).font(fonts.bold).fillColor(COLOR.ink).text("Ringkasan Kemampuan");
    doc.font(fonts.regular).fontSize(fonts.sz(9.5)).fillColor(COLOR.body).text(analysis.ringkasan || "-", {
      width: contentWidth,
      align: "justify",
    });
    doc.moveDown(0.7);

    if (analysis.petaKompetensi && analysis.petaKompetensi.length > 0) {
      doc.fontSize(fonts.sz(10.5)).font(fonts.bold).fillColor(COLOR.ink).text("Peta Kompetensi AI");
      doc.font(fonts.regular);
      doc.moveDown(0.2);
      for (const k of analysis.petaKompetensi) {
        doc.fontSize(fonts.sz(9.5)).fillColor(COLOR.ink).font(fonts.bold)
          .text(`${k.kode}  `, { continued: true, width: contentWidth });
        doc.font(fonts.regular).fillColor(COLOR.body).text(k.narasi, { width: contentWidth });
      }
      doc.moveDown(0.7);
    }

    const kelebihan = analysis.kelebihanSiswa || analysis.levelKognitif;
    if (kelebihan) {
      doc.fontSize(fonts.sz(10.5)).font(fonts.bold).fillColor(COLOR.ink).text("Kelebihan Siswa");
      doc.font(fonts.regular).fontSize(fonts.sz(9.5)).fillColor(COLOR.body)
        .text(kelebihan, { width: contentWidth, align: "justify" });
      doc.moveDown(0.7);
    }

    const kekurangan = analysis.kekuranganSiswa || analysis.polaKesalahan;
    if (kekurangan) {
      doc.fontSize(fonts.sz(10.5)).font(fonts.bold).fillColor(COLOR.ink).text("Kekurangan Siswa");
      doc.font(fonts.regular).fontSize(fonts.sz(9.5)).fillColor(COLOR.body)
        .text(kekurangan, { width: contentWidth, align: "justify" });
      doc.moveDown(0.7);
    }

    if (analysis.rekomendasi && analysis.rekomendasi.length > 0) {
      doc.fontSize(fonts.sz(10.5)).font(fonts.bold).fillColor(COLOR.ink).text("Rekomendasi Belajar");
      doc.font(fonts.regular);
      doc.moveDown(0.2);
      for (const rec of analysis.rekomendasi) {
        doc.fontSize(fonts.sz(9.5)).fillColor(COLOR.body).text(`•  ${rec}`, { width: contentWidth, align: "justify" });
      }
    }

    doc.moveDown(0.6);
    doc.fontSize(fonts.sz(8)).fillColor(COLOR.faint)
      .text("Analisis ini dibuat otomatis oleh AI sebagai alat bantu belajar, bukan penilaian final.", {
        align: "center",
        width: contentWidth,
      });
    doc.moveDown(1.5);
  }

  // --- RINCIAN JAWABAN ---
  doc.addPage();
  doc.fontSize(fonts.sz(14)).font(fonts.bold).fillColor(COLOR.ink).text("Rincian Jawaban", 48, 48);
  doc.font(fonts.regular);
  doc.moveDown(0.6);

  for (let i = 0; i < hasil.perSoal.length; i++) {
    const s = hasil.perSoal[i]!;
    const benar = (s.skor ?? 0) >= s.skorMaks;

    if (doc.y > doc.page.height - 150) doc.addPage();

    // Y diambil eksplisit sebelum menggambar heading - teks dengan lineBreak:false
    // (dipakai untuk heading "Soal N · Format" dan drawBadge) tidak memajukan
    // doc.x/doc.y secara dapat diprediksi seperti teks alur normal. Kalau
    // panggilan berikutnya (isi soal) mengandalkan doc.x/doc.y apa adanya
    // sesudah itu, hasilnya bisa tumpang tindih (Y nyangkut di baris yang sama)
    // atau ke-wrap jadi kolom sempit (X nyangkut dekat tepi kanan bekas badge).
    const headingY = doc.y;
    doc.fontSize(fonts.sz(11)).font(fonts.bold).fillColor(COLOR.ink)
      .text(`Soal ${i + 1}`, 48, headingY, { continued: true, lineBreak: false });
    doc.font(fonts.regular).fillColor(COLOR.faint)
      .text(`  ·  ${FORMAT_LABEL[s.format] ?? s.format}`, { continued: false, lineBreak: false });
    drawBadge(doc, benar ? "Benar" : "Salah", doc.page.width - 48 - 60, headingY - 3, benar ? "success" : "danger", fonts);
    doc.x = 48;
    doc.y = headingY + 24;

    await renderTextWithImages(doc, s.teks, { width: contentWidth, color: COLOR.body }, fonts);
    doc.moveDown(0.3);

    if (hasil.canShowPembahasan) {
      // s.options dan s.statements SELALU array (bisa kosong []), tidak pernah
      // undefined - lihat lib/exam/hasil.ts. Array kosong itu truthy di JS,
      // jadi cek panjang eksplisit; kalau tidak, kedua blok ini sama-sama
      // renders untuk tiap soal (mis. soal pg_kategori ikut menampilkan
      // "Jawaban Siswa:"/"Kunci Jawaban:" kosong dari cabang options, dan
      // soal pg/pg_kompleks ikut menampilkan "Kunci & Jawaban Siswa:" kosong
      // dari cabang statements).
      if (s.options && s.options.length > 0) {
        const jawaban = s.jawabanJson as { option_id?: string; option_ids?: string[] } | null;
        const selectedIds = new Set<string>(
          s.format === "pg" ? (jawaban?.option_id ? [jawaban.option_id] : []) : (jawaban?.option_ids ?? []),
        );

        // Semua pilihan dicetak lengkap (A, B, C, D, ...) seperti di layar,
        // bukan cuma yang dipilih siswa dan kuncinya - versi lama membuat
        // rapor tidak bisa dibaca sebagai soal utuh (pilihan lain yang
        // menjadi pengecoh tidak kelihatan). Penanda di ujung baris:
        // hijau = benar (dipilih benar / kunci yang terlewat), merah =
        // pilihan siswa yang salah, tanpa warna = pilihan lain.
        const tick = fonts.unicode ? "✓" : "[v]";
        const cross = fonts.unicode ? "✗" : "[x]";

        doc.fontSize(fonts.sz(9.5)).font(fonts.bold).fillColor(COLOR.ink).text("Pilihan jawaban:");
        doc.font(fonts.regular);
        for (const opt of s.options) {
          const dipilih = selectedIds.has(opt.id);
          let marker = "";
          let color: string = COLOR.body;
          if (dipilih && opt.isCorrect) {
            marker = `   ${tick} Jawaban siswa (benar)`;
            color = COLOR.success;
          } else if (dipilih) {
            marker = `   ${cross} Jawaban siswa (salah)`;
            color = COLOR.danger;
          } else if (opt.isCorrect) {
            marker = `   ${tick} Kunci jawaban`;
            color = COLOR.success;
          }
          await renderTextWithImages(
            doc,
            `${opt.label}. ${opt.teks}${marker}`,
            { width: contentWidth, color },
            fonts,
          );
        }

        // Ringkasan satu baris untuk dibaca sekilas.
        const allOptions = s.options;
        const labelsOf = (pred: (o: (typeof allOptions)[number]) => boolean) =>
          allOptions.filter(pred).map((o) => o.label).join(", ");
        const dipilihLabel = labelsOf((o) => selectedIds.has(o.id));
        const kunciLabel = labelsOf((o) => o.isCorrect);
        doc.moveDown(0.1);
        doc.fontSize(fonts.sz(9)).fillColor(COLOR.muted).text(
          `Jawaban siswa: ${dipilihLabel || "tidak dijawab"}   ·   Kunci: ${kunciLabel || "-"}`,
          { width: contentWidth },
        );
      }

      if (s.statements && s.statements.length > 0) {
        // Nilai di jawabanJson untuk format pg_kategori adalah categoryId (UUID),
        // BUKAN label - harus di-resolve lewat s.categories dulu, sama seperti
        // halaman web (app/siswa/hasil/[id]/page.tsx). Versi sebelumnya
        // membandingkan categoryId mentah langsung dengan correctLabel (string
        // pendek seperti "Benar"/"Salah"), yang tidak akan pernah cocok -
        // membuat soal pg_kategori selalu tertandai salah di rapor PDF
        // walaupun jawabannya benar, dan menampilkan UUID mentah alih-alih
        // nama kategori yang bisa dibaca.
        const studentChoices =
          typeof s.jawabanJson === "object" && s.jawabanJson !== null && !Array.isArray(s.jawabanJson)
            ? (s.jawabanJson as Record<string, string>)
            : {};

        doc.fontSize(fonts.sz(9.5)).font(fonts.bold).fillColor(COLOR.ink).text("Kunci & Jawaban Siswa:");
        doc.font(fonts.regular);
        if (s.categories && s.categories.length > 0) {
          doc.fontSize(fonts.sz(9)).fillColor(COLOR.muted).text(
            `Pilihan kategori: ${s.categories.map((c) => c.label).join("  /  ")}`,
            { width: contentWidth },
          );
        }
        for (const st of s.statements) {
          const categoryId = studentChoices[st.id];
          const siswaJawab = categoryId
            ? (s.categories?.find((c) => c.id === categoryId)?.label ?? "Kosong")
            : "Kosong";
          const isCorrect = siswaJawab === st.correctLabel;

          doc.fontSize(fonts.sz(9.5)).fillColor(COLOR.body).text(
            `- ${latexToPlainText(st.teks, { unicode: fonts.unicode })}`,
            { width: contentWidth },
          );
          doc.fillColor(isCorrect ? COLOR.success : COLOR.danger)
            .text(`  Siswa: ${siswaJawab}${isCorrect ? " (benar)" : ` (Kunci: ${st.correctLabel})`}`, {
              width: contentWidth,
            });
        }
      }

      if (s.pembahasan) {
        doc.moveDown(0.4);
        doc.fontSize(fonts.sz(9.5)).font(fonts.bold).fillColor(COLOR.ink).text("Pembahasan:");
        doc.font(fonts.regular);
        await renderTextWithImages(doc, s.pembahasan, { width: contentWidth, color: COLOR.muted }, fonts);
      }
    }

    doc.moveDown(0.8);
    doc.rect(48, doc.y, contentWidth, 1).fill(COLOR.border);
    doc.moveDown(1);
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    drawPageNumber(doc, i + 1);
  }
}
