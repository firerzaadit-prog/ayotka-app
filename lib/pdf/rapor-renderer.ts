import "server-only";
import type { buildHasil } from "@/lib/exam/hasil";
import { latexToPlainText } from "@/lib/pdf/latex-to-text";

type Hasil = Awaited<ReturnType<typeof buildHasil>>;
type AiAnalysisDetail = {
  ringkasan?: string;
  petaKompetensi?: { kode: string; narasi: string }[];
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

export async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function renderTextWithImages(
  doc: PDFKit.PDFDocument,
  text: string | null | undefined,
  options: { width: number; align?: "center" | "justify" | "left" | "right"; color?: string },
) {
  if (!text) return;
  doc.fillColor(options.color ?? COLOR.body);
  const regex = /!\[.*?\]\((.*?)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const preText = text.substring(lastIndex, match.index);
    if (preText.trim()) {
      doc.text(latexToPlainText(preText), options);
      doc.moveDown(0.4);
    }

    const url = match[1] as string;
    const buffer = await fetchImageBuffer(url);
    if (buffer) {
      doc.image(buffer, { fit: [options.width, 250], align: "center" });
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
    doc.text(latexToPlainText(postText), options);
    doc.moveDown(0.4);
  }
}

/** Badge kecil bergaya pill (mis. "Benar"/"Salah") - mengembalikan lebar yang dipakai. */
function drawBadge(doc: PDFKit.PDFDocument, text: string, x: number, y: number, variant: "success" | "danger"): number {
  const color = variant === "success" ? COLOR.success : COLOR.danger;
  const bg = variant === "success" ? COLOR.successBg : COLOR.dangerBg;
  doc.fontSize(9).font("Helvetica-Bold");
  const width = doc.widthOfString(text) + 16;
  doc.roundedRect(x, y, width, 17, 8.5).fill(bg);
  doc.fillColor(color).text(text, x + 8, y + 4, { lineBreak: false });
  doc.font("Helvetica");
  return width;
}

/** Baris kompetensi bergaya progress bar. Mengembalikan Y setelah baris ini. */
function drawCompetencyRow(
  doc: PDFKit.PDFDocument,
  c: { kode: string; deskripsi: string; jmlBenar: number; jmlSoal: number; persentase: number },
  x: number,
  y: number,
  width: number,
): number {
  const good = c.persentase >= 70;
  const accent = good ? COLOR.success : COLOR.danger;
  const desc = c.deskripsi.length > 62 ? `${c.deskripsi.slice(0, 61)}…` : c.deskripsi;

  doc.fontSize(9.5).font("Helvetica-Bold").fillColor(COLOR.ink)
    .text(c.kode, x, y, { continued: true, lineBreak: false });
  doc.font("Helvetica").fillColor(COLOR.muted).text(`  ${desc}`, { continued: true, lineBreak: false });
  doc.fillColor(accent).font("Helvetica-Bold")
    .text(`  ${c.jmlBenar}/${c.jmlSoal} · ${c.persentase.toFixed(0)}%`, x, y, { width, align: "right" });
  doc.font("Helvetica");

  const barY = y + 15;
  doc.roundedRect(x, barY, width, 7, 3.5).fill(COLOR.border);
  const fillW = Math.max(6, (width * Math.min(100, c.persentase)) / 100);
  doc.roundedRect(x, barY, fillW, 7, 3.5).fill(accent);

  return barY + 7 + 11;
}

/** Watermark identitas siswa diulang di seluruh halaman - jejak anti-bocor
 * dokumen (rapor PDF adalah artefak paling gampang disebarluaskan, jadi versi
 * cetak/download ini justru paling butuh proteksi ini, sama seperti yang
 * sudah dipasang di halaman web hasil - Tiket 5.9). */
function drawWatermark(doc: PDFKit.PDFDocument, label: string) {
  doc.save();
  doc.rotate(-28, { origin: [doc.page.width / 2, doc.page.height / 2] });
  doc.fontSize(9).font("Helvetica").fillColor(COLOR.ink).opacity(0.06);
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

  drawWatermark(doc, watermarkLabel);
  doc.on("pageAdded", () => {
    drawWatermark(doc, watermarkLabel);
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
  doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold").text("AyoTKA", 90, 40);
  doc.fillColor("#ffffff").fontSize(20).font("Helvetica-Bold").text("Rapor Hasil Ujian", 48, 62);
  doc.font("Helvetica");

  doc.fontSize(10).fillColor("#e0e7ff").text(hasil.package.nama, 48, 48, { align: "right", width: contentWidth });
  doc.fillColor("#c7d2fe").text(hasil.siswa.nama, { align: "right", width: contentWidth });
  doc.fillColor("#c7d2fe").fontSize(9).text(hasil.siswa.idSamar, { align: "right", width: contentWidth });

  doc.y = headerH + 24;

  // --- RINGKASAN NILAI ---
  const summaryY = doc.y;
  const summaryH = 74;
  doc.roundedRect(48, summaryY, contentWidth, summaryH, 10).fill(COLOR.cardBg).stroke(COLOR.border);

  doc.fontSize(9).fillColor(COLOR.muted).text("NILAI AKHIR", 68, summaryY + 16);
  doc.fontSize(30).font("Helvetica-Bold").fillColor(COLOR.primaryFrom)
    .text(hasil.attempt.skorAkhir?.toFixed(1) ?? "-", 68, summaryY + 30);
  doc.font("Helvetica");

  const totalBenar = hasil.perSoal.filter((s) => (s.skor ?? 0) >= s.skorMaks).length;
  const statCol2X = 68 + 150;
  doc.fontSize(9).fillColor(COLOR.muted).text("JAWABAN BENAR", statCol2X, summaryY + 16);
  doc.fontSize(16).font("Helvetica-Bold").fillColor(COLOR.ink)
    .text(`${totalBenar} / ${hasil.perSoal.length}`, statCol2X, summaryY + 32);
  doc.font("Helvetica");

  const statCol3X = statCol2X + 150;
  const statusLabel =
    hasil.attempt.status === "kedaluwarsa" ? "Waktu habis (auto-submit)" : "Selesai";
  doc.fontSize(9).fillColor(COLOR.muted).text("STATUS", statCol3X, summaryY + 16);
  doc.fontSize(11).font("Helvetica-Bold").fillColor(COLOR.ink).text(statusLabel, statCol3X, summaryY + 34, {
    width: contentWidth - (statCol3X - 48) - 20,
  });
  doc.font("Helvetica");

  doc.y = summaryY + summaryH + 26;

  // --- PETA KOMPETENSI ---
  if (hasil.competencyScores.length > 0) {
    doc.fontSize(14).font("Helvetica-Bold").fillColor(COLOR.ink).text("Peta Kompetensi", 48, doc.y);
    doc.font("Helvetica");
    doc.moveDown(0.6);

    for (const c of hasil.competencyScores) {
      if (doc.y > doc.page.height - 90) doc.addPage();
      doc.y = drawCompetencyRow(doc, c, 48, doc.y, contentWidth);
    }
    doc.moveDown(1);
  }

  // --- ANALISIS AI ---
  const analysis = aiAnalysis?.detailJson ?? null;
  if (analysis) {
    if (doc.y > doc.page.height - 220) doc.addPage();

    doc.fontSize(14).font("Helvetica-Bold").fillColor(COLOR.ink).text("Analisis AI", 48, doc.y);
    doc.font("Helvetica");
    doc.moveDown(0.4);

    const accentY = doc.y;
    doc.rect(48, accentY, contentWidth, 3).fill(COLOR.primaryFrom);
    doc.y = accentY + 14;

    doc.fontSize(10).fillColor(COLOR.body).text(analysis.ringkasan || "-", 48, doc.y, {
      width: contentWidth,
      align: "justify",
    });
    doc.moveDown(0.9);

    if (analysis.petaKompetensi && analysis.petaKompetensi.length > 0) {
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(COLOR.ink).text("Peta Kompetensi (AI)");
      doc.font("Helvetica");
      doc.moveDown(0.2);
      for (const k of analysis.petaKompetensi) {
        doc.fontSize(9.5).fillColor(COLOR.ink).font("Helvetica-Bold")
          .text(`${k.kode}  `, { continued: true, width: contentWidth });
        doc.font("Helvetica").fillColor(COLOR.body).text(k.narasi, { width: contentWidth });
      }
      doc.moveDown(0.7);
    }

    if (analysis.levelKognitif) {
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(COLOR.ink).text("Level Kognitif");
      doc.font("Helvetica").fontSize(9.5).fillColor(COLOR.body)
        .text(analysis.levelKognitif, { width: contentWidth, align: "justify" });
      doc.moveDown(0.7);
    }

    if (analysis.polaKesalahan) {
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(COLOR.ink).text("Pola Kesalahan");
      doc.font("Helvetica").fontSize(9.5).fillColor(COLOR.body)
        .text(analysis.polaKesalahan, { width: contentWidth, align: "justify" });
      doc.moveDown(0.7);
    }

    if (analysis.rekomendasi && analysis.rekomendasi.length > 0) {
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(COLOR.ink).text("Rekomendasi Belajar");
      doc.font("Helvetica");
      doc.moveDown(0.2);
      for (const rec of analysis.rekomendasi) {
        doc.fontSize(9.5).fillColor(COLOR.body).text(`•  ${rec}`, { width: contentWidth, align: "justify" });
      }
    }

    doc.moveDown(0.6);
    doc.fontSize(8).fillColor(COLOR.faint)
      .text("Analisis ini dibuat otomatis oleh AI sebagai alat bantu belajar, bukan penilaian final.", {
        align: "center",
        width: contentWidth,
      });
    doc.moveDown(1.5);
  }

  // --- RINCIAN JAWABAN ---
  doc.addPage();
  doc.fontSize(14).font("Helvetica-Bold").fillColor(COLOR.ink).text("Rincian Jawaban", 48, 48);
  doc.font("Helvetica");
  doc.moveDown(0.6);

  if (!hasil.canShowPembahasan) {
    doc.roundedRect(48, doc.y, contentWidth, 34, 6).fill(COLOR.warnBg);
    doc.fontSize(9.5).fillColor(COLOR.warnText)
      .text("Pembahasan lengkap akan tersedia setelah jendela ujian kelas ditutup.", 60, doc.y + 11, {
        width: contentWidth - 24,
      });
    doc.y += 34;
    doc.moveDown(1);
  }

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
    doc.fontSize(11).font("Helvetica-Bold").fillColor(COLOR.ink)
      .text(`Soal ${i + 1}`, 48, headingY, { continued: true, lineBreak: false });
    doc.font("Helvetica").fillColor(COLOR.faint)
      .text(`  ·  ${FORMAT_LABEL[s.format] ?? s.format}`, { continued: false, lineBreak: false });
    drawBadge(doc, benar ? "Benar" : "Salah", doc.page.width - 48 - 60, headingY - 3, benar ? "success" : "danger");
    doc.x = 48;
    doc.y = headingY + 24;

    await renderTextWithImages(doc, s.teks, { width: contentWidth, color: COLOR.body });
    doc.moveDown(0.3);

    if (hasil.canShowPembahasan) {
      if (s.options) {
        const jawaban = s.jawabanJson as { option_id?: string; option_ids?: string[] } | null;
        const selectedId = jawaban?.option_id;
        const selectedIds = new Set(jawaban?.option_ids ?? []);
        const chosenOptions = s.options.filter((o) =>
          s.format === "pg" ? o.id === selectedId : selectedIds.has(o.id),
        );
        const kunciOptions = s.options.filter((o) => o.isCorrect);

        doc.fontSize(9.5).font("Helvetica-Bold").fillColor(COLOR.ink).text("Jawaban Siswa:");
        doc.font("Helvetica");
        if (chosenOptions.length > 0) {
          for (const opt of chosenOptions) {
            await renderTextWithImages(doc, `${opt.label}. ${opt.teks}`, {
              width: contentWidth,
              color: opt.isCorrect ? COLOR.success : COLOR.danger,
            });
          }
        } else {
          doc.fontSize(9.5).fillColor(COLOR.faint).text("Kosong / Tidak dijawab");
        }
        doc.moveDown(0.4);

        doc.fontSize(9.5).font("Helvetica-Bold").fillColor(COLOR.ink).text("Kunci Jawaban:");
        doc.font("Helvetica");
        for (const opt of kunciOptions) {
          await renderTextWithImages(doc, `${opt.label}. ${opt.teks}`, {
            width: contentWidth,
            color: COLOR.success,
          });
        }
      }

      if (s.statements) {
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

        doc.fontSize(9.5).font("Helvetica-Bold").fillColor(COLOR.ink).text("Kunci & Jawaban Siswa:");
        doc.font("Helvetica");
        for (const st of s.statements) {
          const categoryId = studentChoices[st.id];
          const siswaJawab = categoryId
            ? (s.categories?.find((c) => c.id === categoryId)?.label ?? "Kosong")
            : "Kosong";
          const isCorrect = siswaJawab === st.correctLabel;

          doc.fontSize(9.5).fillColor(COLOR.body).text(`- ${latexToPlainText(st.teks)}`, { width: contentWidth });
          doc.fillColor(isCorrect ? COLOR.success : COLOR.danger)
            .text(`  Siswa: ${siswaJawab}${isCorrect ? " (benar)" : ` (Kunci: ${st.correctLabel})`}`, {
              width: contentWidth,
            });
        }
      }

      if (s.pembahasan) {
        doc.moveDown(0.4);
        doc.fontSize(9.5).font("Helvetica-Bold").fillColor(COLOR.ink).text("Pembahasan:");
        doc.font("Helvetica");
        await renderTextWithImages(doc, s.pembahasan, { width: contentWidth, color: COLOR.muted });
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
