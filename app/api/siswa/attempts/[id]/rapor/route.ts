import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db/prisma";
import { requireRole, type CurrentUser } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { loadOwnedAttempt } from "@/lib/exam/attempt-access";
import { buildHasil } from "@/lib/exam/hasil";
import { latexToPlainText } from "@/lib/pdf/latex-to-text";
import type { Attempt } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

async function loadAttemptForRapor(user: CurrentUser, attemptId: string): Promise<Attempt | null> {
  if (user.role === "siswa") {
    return loadOwnedAttempt(user.id, attemptId);
  }
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { student: true },
  });
  if (!attempt) return null;
  if (user.role === "admin_pusat") return attempt;
  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId || attempt.student.schoolId !== schoolId) return null;
  return attempt;
}

async function renderTextWithImages(
  doc: PDFKit.PDFDocument,
  text: string | null | undefined,
  options: { width: number; align?: "center" | "justify" | "left" | "right"; continued?: boolean }
) {
  if (!text) return;
  const regex = /!\[.*?\]\((.*?)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const preText = text.substring(lastIndex, match.index);
    if (preText.trim()) {
      doc.text(latexToPlainText(preText), options);
      doc.moveDown(0.5);
    }

    const url = match[1] as string;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Ensure image doesn't overflow page bottom
        // pdfkit will automatically page wrap text, but for images it might be tricky.
        // Usually doc.image handles basic wrap if we just provide fit.
        doc.image(buffer, { fit: [options.width, 250], align: "center" });
        doc.moveDown(0.5);
      } else {
        doc.fillColor("#ef4444").text(`[Gambar gagal dimuat]`, options);
        doc.moveDown(0.5);
      }
    } catch (err) {
      doc.fillColor("#ef4444").text(`[Gambar gagal dimuat]`, options);
      doc.moveDown(0.5);
    }

    lastIndex = regex.lastIndex;
  }

  const postText = text.substring(lastIndex);
  if (postText.trim()) {
    doc.text(latexToPlainText(postText), options);
    doc.moveDown(0.5);
  }
}

export async function GET(_request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("siswa", "admin_sekolah", "admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const attempt = await loadAttemptForRapor(user, id);
  if (!attempt) {
    return NextResponse.json({ error: "Attempt tidak ditemukan." }, { status: 404 });
  }
  if (attempt.status === "berjalan" || attempt.status === "paused") {
    return NextResponse.json({ error: "Rapor belum tersedia - ujian belum selesai." }, { status: 400 });
  }

  const hasil = await buildHasil(attempt);

  // Ambil AI Analysis jika ada
  const aiAnalysis = await prisma.aiAnalysis.findUnique({
    where: { attemptId: attempt.id },
  });

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const contentWidth = doc.page.width - 96;

  // --- HEADER ---
  doc.rect(0, 0, doc.page.width, 120).fill("#1e293b"); // Dark blue background
  doc.fillColor("#ffffff").fontSize(24).text("Rapor Hasil Ujian", 48, 48);
  doc.fontSize(12).fillColor("#94a3b8").text("AyoTKA", 48, 80);
  
  // Tulis detail di sisi kanan atas
  doc.fontSize(10).fillColor("#cbd5e1").text(hasil.package.nama, 48, 48, { align: "right", width: contentWidth });
  doc.fillColor("#94a3b8").text(`${hasil.siswa.nama} · ${hasil.siswa.idSamar}`, { align: "right", width: contentWidth });
  doc.fillColor("#94a3b8").text(`Skor Akhir: ${hasil.attempt.skorAkhir?.toFixed(1) ?? "-"}`, { align: "right", width: contentWidth });
  
  doc.y = 150; // Set starting Y after header

  // --- PETA KOMPETENSI ---
  if (hasil.competencyScores.length > 0) {
    doc.fontSize(14).fillColor("#0f172a").text("Peta Kompetensi", 48, doc.y);
    doc.moveDown(0.5);
    
    for (const c of hasil.competencyScores) {
      doc.rect(48, doc.y, contentWidth, 30).fill("#f8fafc").stroke("#e2e8f0");
      doc.fillColor("#334155").fontSize(10).text(`${c.kode}: ${c.deskripsi}`, 58, doc.y + 10, { width: contentWidth - 100, continued: true });
      doc.fillColor(c.persentase >= 70 ? "#15803d" : "#b91c1c").text(`  ${c.jmlBenar}/${c.jmlSoal} (${c.persentase.toFixed(0)}%)`, { align: "right" });
      doc.y += 25;
    }
    doc.moveDown(2);
  }

  // --- ANALISIS AI ---
  if (aiAnalysis) {
    const analysis = aiAnalysis.detailJson as any;
    
    // Pastikan AI Analysis tidak terpotong di tengah halaman
    if (doc.y > doc.page.height - 200) doc.addPage();
    
    doc.fontSize(14).fillColor("#0f172a").text("Analisis AI", 48, doc.y);
    doc.moveDown(0.5);
    
    doc.rect(48, doc.y, contentWidth, 5).fill("#6366f1");
    doc.y += 15;

    doc.fontSize(10).fillColor("#334155").text(analysis.ringkasan || "-", { width: contentWidth, align: "justify" });
    doc.moveDown(1);

    doc.fontSize(11).fillColor("#1e293b").text("Pola Kesalahan:");
    doc.fontSize(10).fillColor("#475569").text(analysis.polaKesalahan || "-", { width: contentWidth, align: "justify" });
    doc.moveDown(1);

    doc.fontSize(11).fillColor("#1e293b").text("Rekomendasi Belajar:");
    doc.moveDown(0.3);
    for (const rec of analysis.rekomendasi || []) {
      doc.fontSize(10).fillColor("#475569").text(`• ${rec}`, { width: contentWidth, align: "justify" });
    }
    
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor("#94a3b8").text("Analisis ini dibuat otomatis oleh AI sebagai alat bantu belajar, bukan penilaian final.", { align: "center", width: contentWidth });
    doc.moveDown(2);
  }

  // --- RINCIAN JAWABAN ---
  doc.addPage();
  doc.fontSize(14).fillColor("#0f172a").text("Rincian Jawaban", 48, 48);
  doc.moveDown(0.5);

  if (!hasil.canShowPembahasan) {
    doc.fontSize(10).fillColor("#b45309").text("Pembahasan lengkap akan tersedia setelah jendela ujian kelas ditutup.");
    doc.moveDown(1);
  }

  for (let i = 0; i < hasil.perSoal.length; i++) {
    const s = hasil.perSoal[i]!;
    const benar = (s.skor ?? 0) >= s.skorMaks;
    
    if (doc.y > doc.page.height - 150) doc.addPage();
    
    const startY = doc.y;
    
    // Nomor Soal dan Status
    doc.fontSize(11).fillColor("#1e293b").text(`Soal ${i + 1}`, 48, doc.y, { continued: true });
    doc.fillColor(benar ? "#15803d" : "#b91c1c").text(`   [${benar ? "Benar" : "Salah"}]`);
    doc.moveDown(0.5);

    // Teks Soal & Gambar
    doc.fontSize(10).fillColor("#334155");
    await renderTextWithImages(doc, s.teks, { width: contentWidth });
    doc.moveDown(0.5);

    if (hasil.canShowPembahasan) {
      // Jawaban Siswa
      if (s.options) {
        const studentChoices = Array.isArray(s.jawabanJson) ? s.jawabanJson : [];
        const chosenOptions = s.options.filter(o => studentChoices.includes(o.id));
        const kunciOptions = s.options.filter(o => o.isCorrect);
        
        doc.fontSize(10).fillColor("#0f172a").text("Jawaban Siswa:");
        if (chosenOptions.length > 0) {
          for (const opt of chosenOptions) {
            doc.fillColor(opt.isCorrect ? "#15803d" : "#b91c1c");
            await renderTextWithImages(doc, `${opt.label}. ${opt.teks}`, { width: contentWidth });
          }
        } else {
          doc.fillColor("#94a3b8").text("Kosong / Tidak dijawab");
        }
        
        doc.moveDown(0.5);
        
        // Kunci
        doc.fontSize(10).fillColor("#0f172a").text("Kunci Jawaban:");
        doc.fillColor("#15803d");
        for (const opt of kunciOptions) {
          await renderTextWithImages(doc, `${opt.label}. ${opt.teks}`, { width: contentWidth });
        }
      }
      
      if (s.statements) {
        // True/False or Matrix
        const studentChoices = (typeof s.jawabanJson === "object" && s.jawabanJson !== null && !Array.isArray(s.jawabanJson))
          ? (s.jawabanJson as Record<string, string>)
          : {};
        
        doc.fontSize(10).fillColor("#0f172a").text("Kunci & Jawaban Siswa:");
        for (const st of s.statements) {
          const sAns = studentChoices[st.id] || "Kosong";
          const isCorrect = sAns === st.correctLabel;
          
          doc.fillColor("#334155").text(`- ${latexToPlainText(st.teks)}`, { width: contentWidth });
          doc.fillColor(isCorrect ? "#15803d" : "#b91c1c").text(`  Siswa: ${sAns} (Kunci: ${st.correctLabel})`, { width: contentWidth });
        }
      }

      if (s.pembahasan) {
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor("#0f172a").text("Pembahasan:");
        doc.fillColor("#475569");
        await renderTextWithImages(doc, s.pembahasan, { width: contentWidth });
      }
    }
    
    doc.moveDown(1);
    doc.rect(48, doc.y, contentWidth, 1).fill("#e2e8f0");
    doc.moveDown(1);
  }

  doc.end();
  const pdfBuffer = await donePromise;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapor-${hasil.siswa.nama.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
