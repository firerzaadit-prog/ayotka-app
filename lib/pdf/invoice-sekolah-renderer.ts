import "server-only";
import { COLOR, setupFonts } from "@/lib/pdf/pdf-umum";
import { formatWIBDate, formatWIBHariTanggal } from "@/lib/utils/datetime";
import { formatRupiah } from "@/lib/billing/school-invoice";
import { terbilang } from "@/lib/utils/terbilang";
import type { SchoolInvoice, School, PeriodeLangganan } from "@prisma/client";

export type DataInvoiceSekolah = {
  invoice: SchoolInvoice;
  school: Pick<School, "nama" | "npsn" | "jenjang" | "kodeSekolah" | "alamat" | "kabupatenKota" | "provinsi" | "statusSekolah">;
  periode?: Pick<PeriodeLangganan, "nama" | "mulai" | "berakhir"> | null;
  bankAccount?: {
    namaBank: string;
    nomorRekening: string;
    atasNama: string;
  } | null;
};

/**
 * Render PDF Invoice Pembayaran Sekolah AyoTKA yang profesional dan elegan.
 * Mengikuti Sistem Desain AyoTKA (Indigo/Violet palette, tipografi rapi, koordinat terukur).
 */
export async function renderInvoiceSekolahPdf(
  doc: PDFKit.PDFDocument,
  data: DataInvoiceSekolah,
  logoBuffer: Buffer | null,
) {
  const fonts = setupFonts(doc);
  doc.font(fonts.regular);

  const { invoice, school, periode, bankAccount } = data;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2; // 515.28 pt

  // Helper untuk menulis teks dengan posisi eksplisit
  function text(
    str: string,
    x: number,
    y: number,
    w: number,
    size: number,
    color: string = COLOR.body,
    bold = false,
    align: "left" | "center" | "right" = "left",
  ) {
    doc.font(bold ? fonts.bold : fonts.regular)
      .fontSize(fonts.sz(size))
      .fillColor(color)
      .text(str, x, y, { width: w, align, lineBreak: false });
  }

  // Helper untuk kotak bulat (rounded rectangle)
  function box(
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor?: string,
    strokeColor?: string,
    radius = 6,
  ) {
    if (fillColor && strokeColor) {
      doc.roundedRect(x, y, w, h, radius).fillAndStroke(fillColor, strokeColor);
    } else if (fillColor) {
      doc.roundedRect(x, y, w, h, radius).fill(fillColor);
    } else if (strokeColor) {
      doc.roundedRect(x, y, w, h, radius).stroke(strokeColor);
    }
  }

  // ==========================================
  // 1. TOP BRAND ACCENT BAR
  // ==========================================
  const brandBarH = 6;
  const gradient = doc.linearGradient(0, 0, pageWidth, 0);
  gradient.stop(0, COLOR.primaryFrom).stop(1, COLOR.primaryTo);
  doc.rect(0, 0, pageWidth, brandBarH).fill(gradient);

  // ==========================================
  // 2. HEADER: LOGO & INVOICE TITLE
  // ==========================================
  let currentY = 28;

  // Logo & Branding AyoTKA (Kiri)
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, marginX, currentY, { width: 40, height: 40, fit: [40, 40] });
    } catch {
      // Fallback tanpa logo
    }
  }

  const logoOffset = logoBuffer ? 48 : 0;
  text("AyoTKA", marginX + logoOffset, currentY + 2, 200, 16, COLOR.ink, true);
  text("Platform Asesmen & Try Out Terpadu", marginX + logoOffset, currentY + 22, 230, 8.5, COLOR.muted);

  // INVOICE Header & Badge (Kanan)
  const headerRightWidth = 240;
  const headerRightX = marginX + contentWidth - headerRightWidth;

  text("INVOICE PEMBAYARAN", headerRightX, currentY - 2, headerRightWidth, 16, COLOR.primaryFrom, true, "right");
  text(`No: ${invoice.nomorInvoice}`, headerRightX, currentY + 18, headerRightWidth, 10, COLOR.ink, true, "right");

  // Status Badge
  const badgeWidth = 140;
  const badgeHeight = 22;
  const badgeX = marginX + contentWidth - badgeWidth;
  const badgeY = currentY + 36;

  let badgeBg: string = COLOR.warnBg;
  let badgeBorder: string = "#fde68a";
  let badgeText: string = COLOR.warnText;
  let statusLabel: string = "MENUNGGU PEMBAYARAN";

  if (invoice.status === "lunas") {
    badgeBg = COLOR.successBg;
    badgeBorder = "#a7f3d0";
    badgeText = COLOR.success;
    statusLabel = "LUNAS";
  } else if (invoice.status === "dibatalkan") {
    badgeBg = COLOR.dangerBg;
    badgeBorder = "#fecdd3";
    badgeText = COLOR.danger;
    statusLabel = "DIBATALKAN";
  }

  box(badgeX, badgeY, badgeWidth, badgeHeight, badgeBg, badgeBorder, 11);
  text(statusLabel, badgeX, badgeY + 5.5, badgeWidth, 8, badgeText, true, "center");

  currentY = 88;

  // Garis pemisah halus
  doc.strokeColor(COLOR.border).lineWidth(1).moveTo(marginX, currentY).lineTo(marginX + contentWidth, currentY).stroke();
  currentY += 16;

  // ==========================================
  // 3. DUA KARTU INFORMASI (DITAGIHKAN & METADATA)
  // ==========================================
  const cardGap = 16;
  const cardWidth = (contentWidth - cardGap) / 2;
  const cardHeight = 112;

  // Kartu Kiri: DITAGIHKAN KEPADA (Sekolah)
  const card1X = marginX;
  box(card1X, currentY, cardWidth, cardHeight, COLOR.cardBg, COLOR.border, 8);

  text("DITAGIHKAN KEPADA:", card1X + 14, currentY + 12, cardWidth - 28, 7.5, COLOR.muted, true);
  text(school.nama, card1X + 14, currentY + 26, cardWidth - 28, 11, COLOR.ink, true);

  const jenjangTeks = `Jenjang: ${school.jenjang}${school.statusSekolah ? ` (${school.statusSekolah.toUpperCase()})` : ""}`;
  const npsnTeks = school.npsn ? ` · NPSN: ${school.npsn}` : "";
  text(`${jenjangTeks}${npsnTeks}`, card1X + 14, currentY + 44, cardWidth - 28, 8.5, COLOR.body);

  const wilayah = [school.kabupatenKota, school.provinsi].filter(Boolean).join(", ");
  if (wilayah) {
    text(wilayah, card1X + 14, currentY + 58, cardWidth - 28, 8.5, COLOR.body);
  }

  if (school.alamat) {
    text(school.alamat, card1X + 14, currentY + 72, cardWidth - 28, 8, COLOR.muted);
  }
  text(`Kode Sekolah: ${school.kodeSekolah}`, card1X + 14, currentY + 88, cardWidth - 28, 8, COLOR.faint, true);

  // Kartu Kanan: DETAIL INVOICE & PENERBIT
  const card2X = marginX + cardWidth + cardGap;
  box(card2X, currentY, cardWidth, cardHeight, COLOR.cardBg, COLOR.border, 8);

  text("INFORMASI INVOICE:", card2X + 14, currentY + 12, cardWidth - 28, 7.5, COLOR.muted, true);

  // Baris Tanggal Terbit
  text("Tanggal Terbit", card2X + 14, currentY + 28, 90, 8.5, COLOR.muted);
  text(`: ${formatWIBDate(invoice.tanggalInvoice)}`, card2X + 104, currentY + 28, cardWidth - 118, 8.5, COLOR.ink, true);

  // Baris Jatuh Tempo
  text("Jatuh Tempo", card2X + 14, currentY + 44, 90, 8.5, COLOR.muted);
  text(`: ${formatWIBHariTanggal(invoice.jatuhTempo)}`, card2X + 104, currentY + 44, cardWidth - 118, 8.5, COLOR.danger, true);

  if (invoice.dibayarAt && invoice.status === "lunas") {
    text("Tanggal Bayar", card2X + 14, currentY + 60, 90, 8.5, COLOR.muted);
    text(`: ${formatWIBDate(invoice.dibayarAt)}`, card2X + 104, currentY + 60, cardWidth - 118, 8.5, COLOR.success, true);
  }

  // Penerbit
  text("Penerbit", card2X + 14, currentY + (invoice.dibayarAt && invoice.status === "lunas" ? 76 : 64), 90, 8.5, COLOR.muted);
  text(": PT Ayo TKA Edukasi", card2X + 104, currentY + (invoice.dibayarAt && invoice.status === "lunas" ? 76 : 64), cardWidth - 118, 8.5, COLOR.ink);

  text("Kontak / Bantuan: support@ayotka.id · https://ayotka.id", card2X + 14, currentY + 92, cardWidth - 28, 7.5, COLOR.faint);

  currentY += cardHeight + 18;

  // ==========================================
  // 4. TABEL RINCIAN ITEM / LAYANAN
  // ==========================================
  const colWidths = {
    no: 32,
    deskripsi: 235,
    qty: 70,
    harga: 85,
    total: 93.28,
  };

  const tableHeaderH = 26;
  box(marginX, currentY, contentWidth, tableHeaderH, "#f1f5f9", COLOR.border, 6);

  let colX = marginX;
  text("NO", colX, currentY + 8, colWidths.no, 7.5, COLOR.muted, true, "center");
  colX += colWidths.no;

  text("DESKRIPSI LAYANAN", colX + 8, currentY + 8, colWidths.deskripsi - 8, 7.5, COLOR.muted, true);
  colX += colWidths.deskripsi;

  text("JUMLAH SISWA", colX, currentY + 8, colWidths.qty, 7.5, COLOR.muted, true, "center");
  colX += colWidths.qty;

  text("HARGA / SISWA", colX, currentY + 8, colWidths.harga - 8, 7.5, COLOR.muted, true, "right");
  colX += colWidths.harga;

  text("TOTAL", colX, currentY + 8, colWidths.total - 12, 7.5, COLOR.muted, true, "right");

  currentY += tableHeaderH;

  // Baris Item Utama
  const rowH = 56;
  box(marginX, currentY, contentWidth, rowH, "#ffffff", COLOR.border, 0);

  colX = marginX;
  text("1", colX, currentY + 14, colWidths.no, 9, COLOR.body, false, "center");
  colX += colWidths.no;

  // Deskripsi
  const judulLayanan = "Paket Akses Ujian Try Out AyoTKA";
  text(judulLayanan, colX + 8, currentY + 12, colWidths.deskripsi - 16, 9.5, COLOR.ink, true);

  const deskripsiKeterangan = invoice.keterangan || (periode?.nama ? `Periode: ${periode.nama}` : "Persiapan Ujian & Tes Kemampuan Akademik (TKA)");
  text(deskripsiKeterangan, colX + 8, currentY + 28, colWidths.deskripsi - 16, 8, COLOR.muted);

  colX += colWidths.deskripsi;

  text(`${invoice.jumlahSiswa.toLocaleString("id-ID")} Kursi`, colX, currentY + 14, colWidths.qty, 9, COLOR.ink, false, "center");
  text("(Siswa Aktif)", colX, currentY + 28, colWidths.qty, 7.5, COLOR.faint, false, "center");
  colX += colWidths.qty;

  text(formatRupiah(invoice.hargaPerSiswa), colX, currentY + 14, colWidths.harga - 8, 9, COLOR.ink, false, "right");
  colX += colWidths.harga;

  text(formatRupiah(invoice.totalAmount), colX, currentY + 14, colWidths.total - 12, 9.5, COLOR.primaryFrom, true, "right");

  currentY += rowH;

  // ==========================================
  // 5. SUMMARY / TOTAL TAGIHAN
  // ==========================================
  const summaryWidth = 248;
  const summaryX = marginX + contentWidth - summaryWidth;

  currentY += 12;

  // Subtotal
  text("Subtotal", summaryX, currentY, 100, 8.5, COLOR.muted);
  text(formatRupiah(invoice.subtotal), summaryX + 100, currentY, summaryWidth - 100, 8.5, COLOR.body, false, "right");
  currentY += 16;

  // Pajak / PPN
  text("PPN (0% Bebas Pajak)", summaryX, currentY, 130, 8.5, COLOR.muted);
  text("Rp 0", summaryX + 130, currentY, summaryWidth - 130, 8.5, COLOR.body, false, "right");
  currentY += 18;

  // Total Tagihan Card
  const totalBoxH = 38;
  box(summaryX, currentY, summaryWidth, totalBoxH, COLOR.cardBg, COLOR.primaryFrom, 8);
  text("TOTAL TAGIHAN", summaryX + 12, currentY + 12, 100, 9, COLOR.ink, true);
  text(formatRupiah(invoice.totalAmount), summaryX + 100, currentY + 10, summaryWidth - 112, 13, COLOR.primaryFrom, true, "right");

  currentY += totalBoxH + 8;

  // Terbilang
  const terbilangTeks = `Terbilang: ${terbilang(invoice.totalAmount)}`;
  doc.font(fonts.regular)
    .fontSize(fonts.sz(8))
    .fillColor(COLOR.muted)
    .text(terbilangTeks, marginX, currentY, { width: contentWidth, align: "right" });

  currentY += 24;

  // ==========================================
  // 6. PETUNJUK PEMBAYARAN & REKENING BANK
  // ==========================================
  const bankBoxH = 110;
  box(marginX, currentY, contentWidth, bankBoxH, COLOR.cardBg, COLOR.border, 8);

  text("PETUNJUK PEMBAYARAN TRANSFER BANK:", marginX + 16, currentY + 12, contentWidth - 32, 8, COLOR.muted, true);

  const bankInfoTeks = invoice.bankTujuan || (bankAccount ? `${bankAccount.namaBank} - No. Rek: ${bankAccount.nomorRekening} a.n. ${bankAccount.atasNama}` : "Bank Mandiri - No. Rek: 144-00-1234567-8 a.n. PT Ayo TKA Edukasi");

  box(marginX + 16, currentY + 28, contentWidth - 32, 34, "#ffffff", COLOR.border, 6);
  text("Rekening Tujuan:", marginX + 28, currentY + 34, 100, 7.5, COLOR.muted);
  text(bankInfoTeks, marginX + 28, currentY + 46, contentWidth - 56, 9.5, COLOR.primaryFrom, true);

  text(
    `1. Mohon sertakan Nomor Invoice (${invoice.nomorInvoice}) pada berita transfer agar otomatis terverifikasi.`,
    marginX + 16,
    currentY + 70,
    contentWidth - 32,
    8,
    COLOR.body,
  );
  text(
    "2. Setelah melakukan pembayaran, bukti transfer dapat dikonfirmasikan ke Admin Pusat melalui sistem atau WhatsApp.",
    marginX + 16,
    currentY + 84,
    contentWidth - 32,
    8,
    COLOR.body,
  );

  currentY += bankBoxH + 14;

  // Catatan Tambahan Admin (jika ada)
  if (invoice.catatan) {
    box(marginX, currentY, contentWidth, 36, COLOR.cardBg, COLOR.border, 6);
    text("Catatan Khusus:", marginX + 12, currentY + 8, 90, 7.5, COLOR.muted, true);
    text(invoice.catatan, marginX + 12, currentY + 20, contentWidth - 24, 8, COLOR.body);
    currentY += 46;
  }

  // ==========================================
  // 7. FOOTER RESMI
  // ==========================================
  const footerY = pageHeight - 48;
  doc.strokeColor(COLOR.border).lineWidth(0.5).moveTo(marginX, footerY - 8).lineTo(marginX + contentWidth, footerY - 8).stroke();

  text(
    "Invoice ini sah dan diterbitkan secara digital oleh sistem AyoTKA. Tidak memerlukan tanda tangan basah.",
    marginX,
    footerY,
    contentWidth * 0.7,
    7.5,
    COLOR.faint,
  );

  text(
    `Dicetak pada ${formatWIBDate(new Date())} · Halaman 1 dari 1`,
    marginX + contentWidth * 0.7,
    footerY,
    contentWidth * 0.3,
    7.5,
    COLOR.faint,
    false,
    "right",
  );
}
