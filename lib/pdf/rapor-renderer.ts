import "server-only";
import type { buildHasil } from "@/lib/exam/hasil";
import { latexToPlainText } from "@/lib/pdf/latex-to-text";
import { competencyTier, COMPETENCY_TIER_HEX } from "@/lib/exam/competency-color";
import type { LaporanIndikatorSiswa } from "@/lib/indikator/daya-serap";
import { COLOR, setupFonts, type PdfFonts } from "@/lib/pdf/pdf-umum";
import { X0, buatPenulis, gambarDaftarFokus, gambarKelompok } from "@/lib/pdf/indikator-gambar";
import { ambilBerkasGambar, ambilGambarRaster, siapkanMedia } from "@/lib/pdf/gambar-pdf";
import {
  TINGGI_KEPALA,
  gambarBlokAnalisis,
  gambarJudulBagian,
  gambarKartuIdentitas,
  gambarKepala,
  gambarLegendaTingkat,
  gambarMedia,
  gambarRingkasan,
  gambarTabelHierarki,
  potongTeks,
  type KotakRingkasan,
  type SelIdentitas,
} from "@/lib/pdf/rapor-komponen";
import { LABEL_JENIS_TRYOUT, rentangWaktuPengerjaan, type IdentitasRapor } from "@/lib/exam/jenis-tryout";
import { parseQuestionMedia } from "@/lib/soal/media-types";
import { formatWIB, formatWIBDate, formatWIBHariTanggal } from "@/lib/utils/datetime";

type Hasil = Awaited<ReturnType<typeof buildHasil>>;
type PerSoal = Hasil["perSoal"][number];
type AiAnalysisDetail = {
  ringkasan?: string;
  /** Field lama (sebelum 2026-09-v7), tidak lagi ditampilkan - lihat lib/ai/version.ts. */
  petaKompetensi?: { kode: string; narasi: string }[];
  kelebihanSiswa?: string;
  kekuranganSiswa?: string;
  levelKognitif?: string;
  polaKesalahan?: string;
  rekomendasi?: string[];
} | null;
type AiAnalysisRecord = { detailJson: AiAnalysisDetail; generatedAt?: Date | string | null } | null;

const FORMAT_LABEL: Record<string, string> = {
  pg: "PG",
  pg_kompleks: "PG Kompleks",
  pg_kategori: "PG Kategori",
};

const asalSitus = () => process.env.NEXT_PUBLIC_APP_URL ?? null;

/** Berkas mentah dari alamat (dipakai untuk logo). null bila gagal; tidak pernah melempar. */
export async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  return ambilBerkasGambar(url, { asalSitus: asalSitus() });
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
    // Hanya PNG/JPEG yang bisa dipasang pdfkit; bentuk lain (WebP, GIF) diubah dulu, dan yang tak bisa diubah dilewati
    // dengan keterangan - dulu gambar WebP membuat seluruh rapor gagal dibuat.
    const buffer = await ambilGambarRaster(url, { asalSitus: asalSitus() });
    let terpasang = false;
    if (buffer) {
      // doc.image() tidak auto-pindah halaman seperti .text() - kalau tidak
      // cukup ruang, gambar digambar apa adanya lalu terpotong rata batas
      // bawah halaman. Cek dulu terhadap tinggi maksimum yang dipakai fit[].
      const maxImageHeight = 250;
      if (doc.y + maxImageHeight > doc.page.height - 62) {
        doc.addPage();
      }
      try {
        doc.image(buffer, { fit: [options.width, maxImageHeight], align: "center" });
        doc.moveDown(0.4);
        terpasang = true;
      } catch {
        terpasang = false;
      }
    }
    if (!terpasang) {
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

type ElemenScoreRow = { elemenNama: string; jmlBenar: number; jmlSoal: number; persentase: number };

function competencyChartHeight(count: number): number {
  return count * 24 + 18;
}

/**
 * Grafik batang horizontal 3 warna per Elemen (gridline + sumbu 0-100%) -
 * Bagian 8.7 brief. Dipakai hanya bila hierarki kompetensi tidak ada (data lama), sama seperti halaman web yang
 * jatuh ke grafik batang. Ambang warna SAMA persis dengan versi web (lihat
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
  scores: ElemenScoreRow[],
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
    const label = s.elemenNama.length > maxLabel ? `${s.elemenNama.slice(0, maxLabel - 1)}…` : s.elemenNama;

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

/**
 * Watermark identitas siswa diulang di seluruh halaman - jejak anti-bocor dokumen (rapor PDF adalah artefak paling
 * gampang disebarluaskan, jadi versi cetak/download ini justru paling butuh proteksi ini). Sejak 12 Okt 2026 watermark HANYA
 * ada di PDF (halaman web tidak lagi memakainya). Digambar di langkah AKHIR untuk setiap halaman (di atas isi, sangat
 * tipis) supaya tetap terlihat di atas kartu dan pita berlatar penuh.
 */
function drawWatermark(doc: PDFKit.PDFDocument, label: string, fonts: PdfFonts) {
  // doc.save()/restore() cuma menyimpan graphics state (rotasi, opacity, dst) -
  // BUKAN posisi kursor doc.x/doc.y. Tiap doc.text() dalam loop ubin di bawah
  // ikut menggeser doc.x/doc.y ke titik ubin terakhir (jauh di luar halaman,
  // dalam ruang koordinat yang sudah dirotasi). Kursor yang rusak itu pernah membuat panggilan .text() berikutnya
  // mengira halaman sudah meluap dan menambah halaman baru lagi, lalu menggambar watermark lagi, dst - satu blok konten
  // menghasilkan puluhan halaman kosong. Karena itu posisi kursor disimpan dan dikembalikan.
  const savedX = doc.x;
  const savedY = doc.y;
  doc.save();
  doc.rotate(-28, { origin: [doc.page.width / 2, doc.page.height / 2] });
  // Font watermark = font isi (bukan Helvetica tetap): doc.font() bukan bagian
  // dari save()/restore(), jadi font yang dipakai di sini menjadi font aktif
  // untuk teks pertama di halaman baru - harus konsisten dengan isi rapor.
  doc.fontSize(9).font(fonts.regular).fillColor(COLOR.ink).opacity(0.06);
  // Lebar ubin mengikuti panjang teks: nama yang sangat panjang tidak boleh bertumpuk dengan ubin di sebelahnya.
  const tileW = Math.max(190, Math.ceil(doc.widthOfString(label)) + 50);
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

/** Garis dan nomor halaman di dasar tiap halaman: "AyoTKA · Rapor Hasil Ujian · {nama}" di kiri, "Halaman N dari M" di kanan. */
function gambarFooter(doc: PDFKit.PDFDocument, fonts: PdfFonts, nomor: number, total: number, namaSiswa: string) {
  // Teks ini sengaja diletakkan di dalam zona margin bawah (30pt dari tepi).
  // pdfkit menganggap posisi di dalam margin sebagai "konten meluap" dan diam-diam
  // menambah halaman baru kosong kalau margins.bottom tidak dinolkan dulu -
  // trik standar pdfkit untuk header/footer di area margin.
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  const H = doc.page.height;
  const W = doc.page.width;
  doc.lineWidth(0.5).moveTo(X0, H - 40).lineTo(W - X0, H - 40).strokeColor(COLOR.border).stroke();
  doc.font(fonts.regular).fontSize(fonts.sz(7.5)).fillColor(COLOR.faint);
  // Kiri: judul dan nama (nama panjang dipotong supaya tetap satu baris); kanan: nomor halaman.
  doc.text(`AyoTKA · Rapor Hasil Ujian · ${potongTeks(namaSiswa, 34)}`, X0, H - 32, { width: W - 2 * X0 - 110, align: "left" });
  doc.text(`Halaman ${nomor} dari ${total}`, W - X0 - 100, H - 32, { width: 100, align: "right" });
  doc.page.margins.bottom = originalBottomMargin;
}

/**
 * Bagian "Daya Serap per Indikator" (standar Kemendikdasmen) di rapor siswa. Seluruh penggambaran kelompok dan daftar
 * dipakai bersama laporan sekolah (lib/pdf/indikator-gambar.ts) yang menjaga aturan gambar PDF AyoTKA.
 */
function gambarDayaSerapIndikator(doc: PDFKit.PDFDocument, laporan: LaporanIndikatorSiswa, fonts: PdfFonts, contentWidth: number) {
  const { toText, tulis, pastikanMuat, dot } = buatPenulis(doc, fonts);

  pastikanMuat(120);
  gambarJudulBagian(doc, fonts, "Daya Serap per Indikator");
  tulis(toText(`${laporan.mapel} ${dot} ${laporan.label.join(" > ")}`), X0, doc.y, contentWidth, 8.5, COLOR.muted);
  doc.moveDown(0.15);
  const cakupan =
    laporan.soalTercakup < laporan.soalTotal
      ? `${laporan.soalTercakup} dari ${laporan.soalTotal} soal pada percobaan ini memiliki indikator resmi Kemendikdasmen dan dihitung di sini.`
      : `Seluruh ${laporan.soalTotal} soal dihitung berdasarkan indikator resmi Kemendikdasmen.`;
  tulis(cakupan, X0, doc.y, contentWidth, 8, COLOR.faint);
  doc.moveDown(0.15);
  // Catatan cara membaca ditaruh di PENGANTAR (bukan di akhir): catatan di akhir pernah terlempar sendirian ke halaman baru.
  tulis(
    "Daya serap = skor yang diperoleh dibagi skor maksimum pada indikator itu. Rerata nasional dari portal resmi daya serap TKA Kemendikdasmen dipakai sebagai pembanding; vonis hanya diberikan di tingkat kelompok.",
    X0,
    doc.y,
    contentWidth,
    7.5,
    COLOR.faint,
  );
  doc.moveDown(0.8);

  gambarKelompok(doc, fonts, contentWidth, laporan.label, laporan.kelompok);
  gambarDaftarFokus(doc, fonts, contentWidth, "Prioritas belajar", "Indikator dengan daya serap terendah: mulai remedial dari sini.", laporan.terlemah, "Semua indikator sudah dikuasai penuh.");
  gambarDaftarFokus(doc, fonts, contentWidth, "Kekuatan", "Indikator dengan daya serap tertinggi.", laporan.terkuat, "Belum ada indikator yang menonjol.");
  doc.font(fonts.regular);
}

/**
 * Satu soal pada bagian Rincian Jawaban, urutannya sama dengan halaman web (components/hasil/rincian-jawaban.tsx):
 * kepala (nomor, format, Benar/Salah), stimulus, teks soal, gambar (diagram dan foto), pilihan jawaban dengan penanda
 * jawaban siswa dan kunci, baris kategori, lalu pembahasan. Keterangan gambar sengaja TIDAK dicetak (seperti di web).
 * Diekspor agar tata letak per soal bisa diuji dari berbagai posisi awal pada halaman (tests/unit/rapor-pdf-blok-utuh.test.ts).
 */
export async function gambarSoal(doc: PDFKit.PDFDocument, fonts: PdfFonts, s: PerSoal, nomor: number, tampilkanKunci: boolean) {
  const { toText, tinggi, tulis, pastikanMuat } = buatPenulis(doc, fonts);
  const CW = doc.page.width - 2 * X0;
  const benar = (s.skor ?? 0) >= s.skorMaks;
  const jumlahHalaman = () => doc.bufferedPageRange().count;

  // --- kepala soal ---
  // Kepala tidak boleh tertinggal sendirian di dasar halaman: harus muat bersama isi awalnya.
  pastikanMuat(120);
  const yKepala = doc.y;
  const tinggiKepala = 22;
  doc.roundedRect(X0, yKepala, CW, tinggiKepala, 5).fill("#f1f5f9");
  const judul = `Soal ${nomor}`;
  doc.font(fonts.bold).fontSize(fonts.sz(10));
  const lebarJudul = doc.widthOfString(judul);
  tulis(judul, X0 + 10, yKepala + 6, lebarJudul + 8, 10, COLOR.ink, true);
  tulis(`·  ${FORMAT_LABEL[s.format] ?? s.format}`, X0 + 10 + lebarJudul + 8, yKepala + 7, 200, 8.5, COLOR.faint);
  const teksLencana = benar ? "Benar" : "Salah";
  doc.font(fonts.bold).fontSize(fonts.sz(9));
  const lebarLencana = doc.widthOfString(teksLencana) + 16;
  drawBadge(doc, teksLencana, X0 + CW - 8 - lebarLencana, yKepala + 2.5, benar ? "success" : "danger", fonts);
  doc.x = X0;
  doc.y = yKepala + tinggiKepala + 8;

  // --- stimulus ---
  if (s.stimulus && s.stimulus.konten?.trim()) {
    const yMulai = doc.y;
    const halamanAwal = jumlahHalaman();
    const judulStimulus = s.stimulus.judul?.trim();
    if (judulStimulus) {
      const teksJudul = `Stimulus: ${toText(judulStimulus)}`;
      tulis(teksJudul, X0 + 12, yMulai, CW - 12, 8.5, COLOR.muted, true);
      doc.y = yMulai + tinggi(teksJudul, 8.5, CW - 12, true) + 4;
    }
    doc.x = X0 + 12;
    doc.font(fonts.regular).fontSize(fonts.sz(9.5));
    await renderTextWithImages(doc, s.stimulus.konten, { width: CW - 12, color: COLOR.body }, fonts);
    // Batang di kiri hanya digambar bila seluruh stimulus ada di satu halaman.
    if (jumlahHalaman() === halamanAwal) doc.roundedRect(X0, yMulai, 2.5, Math.max(6, doc.y - yMulai - 2), 1).fill("#c7d2fe");
    doc.x = X0;
    doc.y += 8;
  }

  // --- teks soal ---
  doc.x = X0;
  doc.font(fonts.regular).fontSize(fonts.sz(10));
  await renderTextWithImages(doc, s.teks, { width: CW, color: COLOR.ink }, fonts);
  doc.moveDown(0.2);

  // --- gambar soal (diagram SVG dan foto), sama dengan yang tampil di web ---
  const media = parseQuestionMedia(s.media);
  if (media) {
    for (const item of media.items) {
      gambarMedia(doc, fonts, await siapkanMedia(item, { asalSitus: asalSitus() }));
    }
  }

  if (!tampilkanKunci) {
    doc.x = X0;
    doc.moveDown(0.8);
    return;
  }

  // --- pilihan jawaban (PG dan PG kompleks) ---
  // s.options dan s.statements SELALU array (bisa kosong []), tidak pernah undefined - lihat lib/exam/hasil.ts. Array
  // kosong itu truthy di JS, jadi cek panjang eksplisit; kalau tidak, kedua blok ini sama-sama tergambar untuk tiap soal.
  if (s.options && s.options.length > 0) {
    const jawaban = s.jawabanJson as { option_id?: string; option_ids?: string[] } | null;
    const selectedIds = new Set<string>(
      s.format === "pg" ? (jawaban?.option_id ? [jawaban.option_id] : []) : (jawaban?.option_ids ?? []),
    );
    const tick = fonts.unicode ? "✓" : "[v]";
    const cross = fonts.unicode ? "✗" : "[x]";
    const lebarPenanda = 112;

    // Ukur semua pilihan DULU supaya kelompok pilihan yang tidak terlalu tinggi tidak terpotong antar halaman.
    const barisOpsi = s.options.map((opt) => {
      const dipilih = selectedIds.has(opt.id);
      let penanda = "";
      let warna: string = COLOR.body;
      let latar: string | null = null;
      if (dipilih && opt.isCorrect) {
        penanda = `${tick} Jawaban siswa (benar)`;
        warna = COLOR.success;
        latar = COLOR.successBg;
      } else if (dipilih) {
        penanda = `${cross} Jawaban siswa (salah)`;
        warna = COLOR.danger;
        latar = COLOR.dangerBg;
      } else if (opt.isCorrect) {
        penanda = `${tick} Kunci jawaban`;
        warna = COLOR.success;
        latar = COLOR.successBg;
      }
      const teksOpsi = `${opt.label}. ${opt.teks}`;
      const bergambar = /!\[.*?\]\(.*?\)/.test(teksOpsi);
      const teks = toText(teksOpsi);
      const h = bergambar ? 0 : Math.max(18, tinggi(teks, 9.5, penanda ? CW - 16 - lebarPenanda : CW - 16) + 8);
      return { teksOpsi, teks, penanda, warna, latar, bergambar, h };
    });
    const adaOpsiBergambar = barisOpsi.some((o) => o.bergambar);
    const totalOpsi = 14 + barisOpsi.reduce((n, o) => n + o.h + 2, 0) + 6;
    pastikanMuat(!adaOpsiBergambar && totalOpsi <= 320 ? totalOpsi : 40);
    // Posisi berikutnya dihitung dari y judul, bukan dari doc.y sesudah menulis: doc.text menggeser doc.y setinggi teksnya,
    // sehingga "doc.y += 14" membuat blok ~9pt lebih tinggi dari yang diukur di atas dan opsi terakhir bisa terlempar sendirian.
    const yJudulOpsi = doc.y;
    tulis("Pilihan jawaban", X0, yJudulOpsi, CW, 8.5, COLOR.muted, true);
    doc.y = yJudulOpsi + 14;

    for (const o of barisOpsi) {
      if (o.bergambar) {
        // Pilihan bergambar: dialirkan apa adanya (gambar tidak bisa dibingkai dengan tinggi yang diketahui di muka).
        doc.x = X0 + 8;
        doc.font(fonts.regular).fontSize(fonts.sz(9.5));
        await renderTextWithImages(doc, `${o.teksOpsi}${o.penanda ? `   ${o.penanda}` : ""}`, { width: CW - 16, color: o.warna }, fonts);
        doc.x = X0;
        continue;
      }
      pastikanMuat(o.h + 3);
      const y = doc.y;
      if (o.latar) doc.roundedRect(X0, y, CW, o.h, 4).fill(o.latar);
      tulis(o.teks, X0 + 8, y + 4, o.penanda ? CW - 16 - lebarPenanda : CW - 16, 9.5, o.warna);
      if (o.penanda) tulis(o.penanda, X0 + CW - 8 - lebarPenanda, y + 5.5, lebarPenanda, 7.5, o.warna, true, "right");
      doc.x = X0;
      doc.y = y + o.h + 2;
    }
    doc.y += 6;
  }

  // --- soal kategori (PG kategori) ---
  if (s.statements && s.statements.length > 0) {
    // Nilai di jawabanJson untuk format pg_kategori adalah categoryId (UUID), BUKAN label - harus di-resolve lewat
    // s.categories dulu, sama seperti halaman web. Versi sebelumnya membandingkan categoryId mentah dengan
    // correctLabel sehingga soal pg_kategori selalu tertandai salah di rapor PDF dan menampilkan UUID mentah.
    const pilihanSiswa =
      typeof s.jawabanJson === "object" && s.jawabanJson !== null && !Array.isArray(s.jawabanJson)
        ? (s.jawabanJson as Record<string, string>)
        : {};
    const teksKategori = s.categories && s.categories.length > 0 ? `Pilihan kategori: ${s.categories.map((c) => c.label).join("  /  ")}` : null;
    const hKategori = teksKategori ? tinggi(teksKategori, 8.5, CW) + 4 : 0;
    const barisPernyataan = s.statements.map((st) => {
      const categoryId = pilihanSiswa[st.id];
      const siswaJawab = categoryId ? (s.categories?.find((c) => c.id === categoryId)?.label ?? "Kosong") : "Kosong";
      const benarBaris = siswaJawab === st.correctLabel;
      const teksPernyataan = `- ${toText(st.teks)}`;
      const keterangan = `Siswa: ${siswaJawab}${benarBaris ? " (benar)" : ` (Kunci: ${st.correctLabel})`}`;
      const hP = tinggi(teksPernyataan, 9.5, CW - 8);
      const hK = tinggi(keterangan, 9, CW - 20);
      return { teksPernyataan, keterangan, benarBaris, hP, hK };
    });
    // Tiap baris di bawah memeriksa ruang setinggi hP + hK + 8 (jarak antar baris 6 + cadangan 2): total harus memuat cadangan itu.
    const totalKategori = 13 + hKategori + barisPernyataan.reduce((n, b) => n + b.hP + b.hK + 6, 0) + 2;
    pastikanMuat(totalKategori <= 320 ? totalKategori : 46);
    const yJudulKategori = doc.y;
    tulis("Kunci & Jawaban Siswa", X0, yJudulKategori, CW, 8.5, COLOR.muted, true);
    let yKategori = yJudulKategori + 13;
    if (teksKategori) {
      tulis(teksKategori, X0, yKategori, CW, 8.5, COLOR.muted);
      yKategori += hKategori;
    }
    doc.y = yKategori;
    for (const b of barisPernyataan) {
      pastikanMuat(b.hP + b.hK + 8);
      const y = doc.y;
      tulis(b.teksPernyataan, X0 + 8, y, CW - 8, 9.5, COLOR.body);
      tulis(b.keterangan, X0 + 20, y + b.hP + 1, CW - 20, 9, b.benarBaris ? COLOR.success : COLOR.danger, true);
      doc.x = X0;
      doc.y = y + b.hP + b.hK + 6;
    }
  }

  // --- pembahasan ---
  if (s.pembahasan?.trim()) {
    doc.moveDown(0.3);
    const adaGambar = /!\[.*?\]\(.*?\)/.test(s.pembahasan);
    const teks = toText(s.pembahasan.replace(/\s+\n/g, "\n"));
    const lebar = CW - 22;
    const hTeks = adaGambar ? 0 : tinggi(teks, 9.5, lebar);
    const kapasitas = doc.page.height - 62 - 48;
    if (!adaGambar && hTeks + 30 <= kapasitas * 0.9) {
      // Kotak pembahasan: dibingkai bila muat dalam satu halaman, dan tidak dipotong antar halaman.
      pastikanMuat(hTeks + 30);
      const y = doc.y;
      doc.roundedRect(X0, y, CW, hTeks + 28, 6).fillAndStroke(COLOR.cardBg, COLOR.border);
      doc.roundedRect(X0, y, 3.5, hTeks + 28, 1.5).fill(COLOR.primaryFrom);
      tulis("Pembahasan", X0 + 14, y + 8, lebar, 9, COLOR.primaryFrom, true);
      tulis(teks, X0 + 14, y + 22, lebar, 9.5, COLOR.muted);
      doc.x = X0;
      doc.y = y + hTeks + 28 + 4;
    } else {
      pastikanMuat(40);
      const yJudulPembahasan = doc.y;
      tulis("Pembahasan", X0, yJudulPembahasan, CW, 9, COLOR.primaryFrom, true);
      doc.y = yJudulPembahasan + 14;
      doc.x = X0;
      doc.font(fonts.regular).fontSize(fonts.sz(9.5));
      await renderTextWithImages(doc, s.pembahasan, { width: CW, color: COLOR.muted }, fonts);
    }
  }

  doc.x = X0;
  doc.moveDown(0.9);
  const yGaris = doc.y;
  if (yGaris < doc.page.height - 62) doc.rect(X0, yGaris, CW, 0.6).fill(COLOR.border);
  doc.y = yGaris + 14;
}

/** Awal-akhir 'Dianalisis pada ...' untuk bagian Learning Analytics; null bila tanggalnya tidak ada atau tidak sah. */
function tanggalAnalisis(nilai: Date | string | null | undefined): string | null {
  if (!nilai) return null;
  const tanggal = typeof nilai === "string" ? new Date(nilai) : nilai;
  return Number.isNaN(tanggal.getTime()) ? null : formatWIB(tanggal, "d MMMM yyyy HH.mm");
}

/**
 * Render seluruh isi rapor ke PDFDocument yang sudah dibuat pemanggil (route
 * yang menangani auth/DB, atau skrip uji visual dengan data tiruan). Dipisah
 * dari route supaya bisa diuji dengan data mock tanpa perlu DB/sesi asli.
 *
 * Susunannya mengikuti halaman web rapor (app/siswa/(shell)/hasil/[id]/page.tsx): nilai (tanpa peringkat: lihat catatan di
 * bawah), Peta Kompetensi, Daya Serap per Indikator, Analisis Learning Analytics, lalu Rincian Jawaban. Ditambah kepala dan
 * kartu identitas (nama, asal sekolah, jenis Try Out, kode soal, tanggal ujian) yang hanya ada di PDF.
 * `identitas` boleh kosong (pemanggil lama): bagian yang tidak diketahui ditulis "-".
 */
export async function renderRaporPdf(
  doc: PDFKit.PDFDocument,
  hasil: Hasil,
  aiAnalysis: AiAnalysisRecord,
  logoBuffer: Buffer | null,
  identitas: IdentitasRapor | null = null,
) {
  const contentWidth = doc.page.width - 96;
  const watermarkLabel = `${hasil.siswa.nama} · ${hasil.siswa.idSamar}`;
  const fonts = setupFonts(doc);
  doc.font(fonts.regular);

  const mapelJenjang = identitas ? [identitas.mataPelajaran, identitas.jenjang].filter(Boolean).join(" · ") : "";

  // Informasi dokumen (judul di tab pembaca PDF, properti berkas).
  doc.info.Title = `Rapor Hasil Ujian - ${potongTeks(hasil.siswa.nama, 80)}`;
  doc.info.Author = "AyoTKA";
  doc.info.Creator = "AyoTKA";
  doc.info.Subject = potongTeks(hasil.package.nama, 120);

  // --- KEPALA ---
  gambarKepala(doc, fonts, {
    logo: logoBuffer,
    jenisLabel: identitas ? LABEL_JENIS_TRYOUT[identitas.jenisTryOut] : null,
    subjudul: mapelJenjang || null,
    dicetak: formatWIBDate(new Date()).replace(/ WIB$/, ""),
  });

  // --- IDENTITAS ---
  const mulai = identitas?.mulaiAt ?? hasil.attempt.mulaiAt;
  const selesai = identitas?.selesaiAt ?? hasil.attempt.selesaiAt ?? null;
  const sel: SelIdentitas[] = [
    { label: "Nama Siswa", nilai: hasil.siswa.nama, sub: hasil.siswa.idSamar ? `ID Peserta ${hasil.siswa.idSamar}` : null },
    { label: "Asal Sekolah", nilai: identitas?.asalSekolah ?? "-" },
    { label: "Jenis Try Out", nilai: identitas ? LABEL_JENIS_TRYOUT[identitas.jenisTryOut] : "-" },
    { label: "Mata Pelajaran", nilai: mapelJenjang || "-" },
    { label: "Nama Paket", nilai: hasil.package.nama },
    { label: "Kode Soal", nilai: identitas?.kodeSoal ?? "-" },
    { label: "Tanggal Ujian", nilai: mulai instanceof Date && !Number.isNaN(mulai.getTime()) ? formatWIBHariTanggal(mulai) : "-" },
    { label: "Waktu Pengerjaan", nilai: mulai instanceof Date ? rentangWaktuPengerjaan(mulai, selesai) : "-" },
  ];
  let y = gambarKartuIdentitas(doc, fonts, TINGGI_KEPALA + 16, sel);

  // --- RINGKASAN NILAI ---
  const totalBenar = hasil.perSoal.filter((s) => (s.skor ?? 0) >= s.skorMaks).length;
  const totalSoal = hasil.perSoal.length;
  const naivePct = totalSoal > 0 ? (totalBenar / totalSoal) * 100 : 0;
  const kotak: KotakRingkasan[] = [
    {
      label: "Nilai Akhir",
      nilai: hasil.attempt.skorAkhir != null ? hasil.attempt.skorAkhir.toFixed(0) : "-",
      sub: "dari 100",
      warna: COLOR.primaryFrom,
      utama: true,
    },
    { label: "Jawaban Benar", nilai: `${totalBenar} / ${totalSoal}`, sub: `${naivePct.toFixed(0)}% soal benar`, warna: COLOR.ink },
    {
      label: "Status",
      nilai: hasil.attempt.status === "kedaluwarsa" ? "Waktu habis" : "Selesai",
      sub: hasil.attempt.status === "kedaluwarsa" ? "dikumpulkan otomatis" : "dikumpulkan",
      warna: hasil.attempt.status === "kedaluwarsa" ? COLOR.warnText : COLOR.success,
    },
  ];
  // Peringkat sengaja TIDAK dicetak di PDF (permintaan user, 13 Okt 2026): peringkat berubah-ubah seiring peserta lain
  // menyelesaikan try out, sedangkan PDF adalah potret tetap yang bisa dipegang berbulan-bulan dan akan berbeda dari angka
  // di web. Peringkat Try Out Nasional tetap tampil hidup di halaman hasil (web); nama peserta lain tidak pernah dicetak.
  y = gambarRingkasan(doc, fonts, y + 14, kotak);
  doc.y = y + 10;

  // "Nilai Akhir" adalah skor tertimbang (tiap soal punya bobot sendiri,
  // penjumlahan skor/skor-maks × 100 - lihat lib/exam/scoring.ts), BUKAN
  // sekadar persentase jumlah-benar/total-soal seperti stat "Jawaban Benar"
  // di sebelahnya. Kalau bobot antar soal seragam kedua angka ini otomatis
  // sama, tapi kalau tidak, angkanya bisa terpaut cukup jauh dan terlihat
  // seperti salah hitung padahal bukan - beri catatan hanya saat itu terjadi.
  if (Math.abs(naivePct - (hasil.attempt.skorAkhir ?? 0)) > 1) {
    doc.fontSize(fonts.sz(8)).fillColor(COLOR.faint).text(
      "Catatan: Nilai Akhir adalah skor tertimbang (tiap soal bisa punya bobot berbeda), bukan sekadar persentase jumlah soal benar.",
      48,
      doc.y,
      { width: contentWidth },
    );
    doc.moveDown(0.6);
  }
  doc.x = X0;
  doc.y += 14;

  // --- PETA KOMPETENSI ---
  if (hasil.elemenScores.length > 0) {
    const adaHierarki = Boolean(hasil.hierarkiKompetensi && hasil.hierarkiKompetensi.length > 0);
    gambarJudulBagian(doc, fonts, "Peta Kompetensi", adaHierarki ? "Capaianmu pada percobaan ini, per Elemen › Subelemen › Kompetensi." : null);
    if (adaHierarki) {
      gambarTabelHierarki(doc, fonts, hasil.hierarkiKompetensi!);
    } else {
      const chartH = competencyChartHeight(hasil.elemenScores.length);
      // Chart digambar sebagai satu blok - kalau tidak cukup muat di sisa halaman ini, pindah halaman DULU.
      if (doc.y + chartH > doc.page.height - 62) doc.addPage();
      doc.y = drawCompetencyChart(doc, hasil.elemenScores, 48, doc.y, contentWidth, fonts);
    }
    gambarLegendaTingkat(doc, fonts);
    doc.y += 4;
  }

  // --- DAYA SERAP PER INDIKATOR (hanya bila ada soal berindikator resmi) ---
  if (hasil.indikator) {
    gambarDayaSerapIndikator(doc, hasil.indikator, fonts, contentWidth);
    doc.x = X0;
    doc.y += 10;
  }

  // --- ANALISIS LEARNING ANALYTICS ---
  const analysis = aiAnalysis?.detailJson ?? null;
  if (analysis) {
    gambarJudulBagian(doc, fonts, "Analisis Learning Analytics", tanggalAnalisis(aiAnalysis?.generatedAt) ? `Dianalisis pada ${tanggalAnalisis(aiAnalysis?.generatedAt)}` : null);
    gambarBlokAnalisis(doc, fonts, { judul: "Ringkasan Kemampuan", warna: COLOR.primaryFrom, paragraf: [analysis.ringkasan || "-"] });
    const kelebihan = analysis.kelebihanSiswa || analysis.levelKognitif;
    if (kelebihan) gambarBlokAnalisis(doc, fonts, { judul: "Kelebihan Siswa", warna: COLOR.success, paragraf: [kelebihan] });
    const kekurangan = analysis.kekuranganSiswa || analysis.polaKesalahan;
    if (kekurangan) gambarBlokAnalisis(doc, fonts, { judul: "Kekurangan Siswa", warna: COLOR.danger, paragraf: [kekurangan] });
    if (analysis.rekomendasi && analysis.rekomendasi.length > 0) {
      gambarBlokAnalisis(doc, fonts, { judul: "Rekomendasi Belajar", warna: COLOR.warnText, daftar: analysis.rekomendasi });
    }
    const { tulis, pastikanMuat } = buatPenulis(doc, fonts);
    pastikanMuat(24);
    tulis("Analisis Learning Analytics ini dibuat otomatis oleh AI sebagai alat bantu belajar, bukan penilaian final.", X0, doc.y, contentWidth, 8, COLOR.faint, false, "center");
    doc.x = X0;
    doc.y += 24;
  }

  // --- RINCIAN JAWABAN ---
  doc.addPage();
  gambarJudulBagian(
    doc,
    fonts,
    "Rincian Jawaban",
    totalSoal > 0 ? `${totalSoal} soal · ${totalBenar} benar · ${totalSoal - totalBenar} salah` : null,
  );
  if (totalSoal === 0) {
    const { tulis } = buatPenulis(doc, fonts);
    tulis("Tidak ada soal pada percobaan ini.", X0, doc.y, contentWidth, 9, COLOR.muted);
  }
  for (let i = 0; i < hasil.perSoal.length; i++) {
    await gambarSoal(doc, fonts, hasil.perSoal[i]!, i + 1, Boolean(hasil.canShowPembahasan));
  }

  // --- LANGKAH AKHIR: watermark (hanya di PDF) dan footer di setiap halaman ---
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    drawWatermark(doc, watermarkLabel, fonts);
    gambarFooter(doc, fonts, i + 1, range.count, hasil.siswa.nama);
  }
}
