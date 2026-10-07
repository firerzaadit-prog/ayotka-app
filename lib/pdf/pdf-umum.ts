import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Konstanta warna dan pemuatan font yang dipakai bersama semua PDF AyoTKA (rapor siswa, laporan sekolah). Dipindah dari
 * lib/pdf/rapor-renderer.ts tanpa perubahan isi supaya renderer lain tidak menggandakannya.
 */
export const COLOR = {
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
export type PdfFonts = {
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

export function setupFonts(doc: PDFKit.PDFDocument): PdfFonts {
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
