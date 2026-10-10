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
  const isLunas = invoice.status === "lunas";
  const badgeWidth = 148;
  const badgeHeight = 22;
  const badgeX = marginX + contentWidth - badgeWidth;
  const badgeY = currentY + 36;

  let badgeBg: string = COLOR.warnBg;
  let badgeBorder: string = "#fde68a";
  let badgeText: string = COLOR.warnText;
  let statusLabel: string = "MENUNGGU PEMBAYARAN";

  if (isLunas) {
    badgeBg = "#ecfdf5";
    badgeBorder = "#34d399";
    badgeText = "#065f46";
    statusLabel = "LUNAS / TERBAYAR";
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
  const cardHeight = 114;

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
  text(`Kode Sekolah: ${school.kodeSekolah}`, card1X + 14, currentY + 89, cardWidth - 28, 8, COLOR.faint, true);

  // Kartu Kanan: DETAIL INVOICE & PENERBIT
  const card2X = marginX + cardWidth + cardGap;
  box(card2X, currentY, cardWidth, cardHeight, COLOR.cardBg, COLOR.border, 8);

  text("INFORMASI INVOICE:", card2X + 14, currentY + 12, cardWidth - 28, 7.5, COLOR.muted, true);

  // Baris Tanggal Terbit
  text("Tanggal Terbit", card2X + 14, currentY + 28, 90, 8.5, COLOR.muted);
  text(`: ${formatWIBDate(invoice.tanggalInvoice)}`, card2X + 104, currentY + 28, cardWidth - 118, 8.5, COLOR.ink, true);

  if (isLunas) {
    // Tanggal Pelunasan
    text("Tanggal Pelunasan", card2X + 14, currentY + 44, 90, 8.5, COLOR.muted);
    const tanggalBayarStr = invoice.dibayarAt ? formatWIBDate(invoice.dibayarAt) : formatWIBDate(invoice.tanggalInvoice);
    text(`: ${tanggalBayarStr}`, card2X + 104, currentY + 44, cardWidth - 118, 8.5, "#059669", true);

    // Status Pembayaran
    text("Status Tagihan", card2X + 14, currentY + 60, 90, 8.5, COLOR.muted);
    text(": LUNAS (Terverifikasi)", card2X + 104, currentY + 60, cardWidth - 118, 8.5, "#059669", true);

    // Penerbit
    text("Penerbit", card2X + 14, currentY + 76, 90, 8.5, COLOR.muted);
    text(": PT Ayo TKA Edukasi", card2X + 104, currentY + 76, cardWidth - 118, 8.5, COLOR.ink);
  } else {
    // Baris Jatuh Tempo
    text("Jatuh Tempo", card2X + 14, currentY + 44, 90, 8.5, COLOR.muted);
    text(`: ${formatWIBHariTanggal(invoice.jatuhTempo)}`, card2X + 104, currentY + 44, cardWidth - 118, 8.5, COLOR.danger, true);

    // Status
    text("Status Tagihan", card2X + 14, currentY + 60, 90, 8.5, COLOR.muted);
    text(": Menunggu Pembayaran", card2X + 104, currentY + 60, cardWidth - 118, 8.5, COLOR.warnText, true);

    // Penerbit
    text("Penerbit", card2X + 14, currentY + 76, 90, 8.5, COLOR.muted);
    text(": PT Ayo TKA Edukasi", card2X + 104, currentY + 76, cardWidth - 118, 8.5, COLOR.ink);
  }

  text("Kontak Bantuan: support@ayotka.id · https://ayotka.id", card2X + 14, currentY + 93, cardWidth - 28, 7.5, COLOR.faint);

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
  // 5. SUMMARY / TOTAL TAGIHAN & STEMPEL DIGITAL
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

  // Jika LUNAS: Gambar Cap / Stempel Digital Resmi di sebelah kiri summary
  if (isLunas) {
    const stampW = 200;
    const stampH = 68;
    const stampX = marginX + 16;
    const stampY = currentY - 32;

    doc.save();
    // Rotasi sedikit (-6 derajat) agar terasa seperti stempel cap basah resmi
    const stampCenterX = stampX + stampW / 2;
    const stampCenterY = stampY + stampH / 2;
    doc.rotate(-6, { origin: [stampCenterX, stampCenterY] });

    // Outer double border
    doc.roundedRect(stampX, stampY, stampW, stampH, 8).lineWidth(2).strokeColor("#059669").stroke();
    doc.roundedRect(stampX + 3.5, stampY + 3.5, stampW - 7, stampH - 7, 5).lineWidth(0.8).strokeColor("#059669").stroke();

    // Teks dalam stempel
    doc.font(fonts.bold).fontSize(fonts.sz(7)).fillColor("#059669").text("★ AYOTKA OFFICIAL STAMP ★", stampX, stampY + 7, { width: stampW, align: "center" });
    doc.font(fonts.bold).fontSize(fonts.sz(17)).fillColor("#047857").text("L U N A S", stampX, stampY + 19, { width: stampW, align: "center" });
    doc.font(fonts.bold).fontSize(fonts.sz(7.5)).fillColor("#059669").text("TERVERIFIKASI SISTEM", stampX, stampY + 41, { width: stampW, align: "center" });
    const tanggalStamp = invoice.dibayarAt ? formatWIBDate(invoice.dibayarAt) : formatWIBDate(invoice.tanggalInvoice);
    doc.font(fonts.regular).fontSize(fonts.sz(6.8)).fillColor("#065f46").text(`Tgl: ${tanggalStamp}`, stampX, stampY + 52, { width: stampW, align: "center" });

    doc.restore();
  }

  currentY += totalBoxH + 8;

  // Terbilang
  const terbilangTeks = `Terbilang: ${terbilang(invoice.totalAmount)}`;
  doc.font(fonts.regular)
    .fontSize(fonts.sz(8))
    .fillColor(COLOR.muted)
    .text(terbilangTeks, marginX, currentY, { width: contentWidth, align: "right" });

  currentY += 24;

  // ==========================================
  // 6. PETUNJUK PEMBAYARAN ATAU BUKTI PELUNASAN RESMI
  // ==========================================
  const bankInfoTeks = invoice.bankTujuan || (bankAccount ? `${bankAccount.namaBank} - No. Rek: ${bankAccount.nomorRekening} a.n. ${bankAccount.atasNama}` : "Bank Mandiri - No. Rek: 144-00-1234567-8 a.n. PT Ayo TKA Edukasi");

  if (isLunas) {
    // KOTAK TANDA TERIMA & KUITANSI SAH (HIJAU EMERALD)
    const receiptBoxH = 104;
    box(marginX, currentY, contentWidth, receiptBoxH, "#f0fdf4", "#86efac", 8);

    text("BUKTI & TANDA TERIMA PELUNASAN RESMI", marginX + 16, currentY + 11, contentWidth - 32, 8.5, "#065f46", true);

    box(marginX + 16, currentY + 26, contentWidth - 32, 36, "#ffffff", "#a7f3d0", 6);
    text("Status Pembayaran:", marginX + 26, currentY + 32, 120, 7.5, COLOR.muted);
    text("LUNAS PENUH — SISA TAGIHAN: RP 0", marginX + 26, currentY + 44, 260, 9.5, "#059669", true);

    text("Metode Pembayaran:", marginX + 290, currentY + 32, 100, 7.5, COLOR.muted);
    text(bankInfoTeks, marginX + 290, currentY + 44, contentWidth - 320, 8.5, COLOR.ink, true);

    text(
      `1. Tagihan invoice ini telah DITERIMA dan DIVERIFIKASI PENUH oleh Tim AyoTKA. Kuota ${invoice.jumlahSiswa} siswa telah aktif.`,
      marginX + 16,
      currentY + 68,
      contentWidth - 32,
      7.8,
      "#065f46",
    );
    text(
      "2. Dokumen elektronik ini diterbitkan secara sah sebagai Kuitansi / Bukti Pembayaran Resmi untuk pembukuan sekolah.",
      marginX + 16,
      currentY + 82,
      contentWidth - 32,
      7.8,
      "#065f46",
    );

    currentY += receiptBoxH + 14;
  } else {
    // KOTAK INSTRUKSI TRANSFER (KUNING / ABU-ABU)
    const bankBoxH = 110;
    box(marginX, currentY, contentWidth, bankBoxH, COLOR.cardBg, COLOR.border, 8);

    text("PETUNJUK PEMBAYARAN TRANSFER BANK:", marginX + 16, currentY + 12, contentWidth - 32, 8, COLOR.muted, true);

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
  }

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
