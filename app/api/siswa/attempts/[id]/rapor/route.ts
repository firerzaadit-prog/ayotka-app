import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db/prisma";
import { requireRole, type CurrentUser } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { loadOwnedAttempt } from "@/lib/exam/attempt-access";
import { buildHasil } from "@/lib/exam/hasil";
import type { Attempt } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

async function loadAttemptForRapor(user: CurrentUser, attemptId: string): Promise<Attempt | null> {
  if (user.role === "siswa") {
    return loadOwnedAttempt(user.id, attemptId);
  }
  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) return null;
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { student: true },
  });
  if (!attempt || attempt.student.schoolId !== schoolId) return null;
  return attempt;
}

/**
 * Tiket 5.8: export PDF rapor - bisa diakses siswa (rapornya sendiri) &
 * admin sekolah (siswa di sekolahnya sendiri saja). Datanya dipetik dari
 * buildHasil() yang sama dengan halaman hasil di layar, supaya angkanya
 * selalu konsisten dengan yang tampil di layar (bukan dihitung ulang
 * terpisah).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("siswa", "admin_sekolah");
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

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(18).fillColor("#0f172a").text("Rapor Hasil Ujian - AyoTKA");
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#475569").text(hasil.package.nama);
  doc
    .fontSize(9)
    .fillColor("#94a3b8")
    .text(`${hasil.siswa.nama} · ${hasil.siswa.idSamar}`);
  doc.moveDown(1);

  doc.fontSize(11).fillColor("#0f172a").text(`Nilai akhir: ${hasil.attempt.skorAkhir?.toFixed(0) ?? "-"}`);
  doc.moveDown(1);

  if (hasil.competencyScores.length > 0) {
    doc.fontSize(13).fillColor("#0f172a").text("Peta Kompetensi");
    doc.moveDown(0.3);
    for (const c of hasil.competencyScores) {
      doc
        .fontSize(9)
        .fillColor("#475569")
        .text(`${c.kode}  ${c.deskripsi} — ${c.jmlBenar}/${c.jmlSoal} (${c.persentase.toFixed(0)}%)`);
    }
    doc.moveDown(1);
  }

  doc.fontSize(13).fillColor("#0f172a").text("Rincian Jawaban");
  doc.moveDown(0.3);
  if (!hasil.canShowPembahasan) {
    doc
      .fontSize(9)
      .fillColor("#b45309")
      .text("Pembahasan lengkap akan tersedia setelah jendela ujian kelas ditutup.");
    doc.moveDown(0.5);
  }

  hasil.perSoal.forEach((s, i) => {
    if (doc.y > doc.page.height - 100) doc.addPage();
    const benar = (s.skor ?? 0) >= s.skorMaks;
    doc
      .fontSize(10)
      .fillColor("#0f172a")
      .text(`${i + 1}. ${s.teks.replace(/<[^>]+>/g, "")}`, { width: doc.page.width - 96 });
    doc
      .fontSize(9)
      .fillColor(benar ? "#15803d" : "#b91c1c")
      .text(benar ? "Benar" : "Salah");
    if (hasil.canShowPembahasan) {
      if (s.options) {
        const kunci = s.options.find((o) => o.isCorrect);
        if (kunci) doc.fontSize(9).fillColor("#475569").text(`Kunci: ${kunci.label}. ${kunci.teks}`);
      }
      if (s.statements) {
        const rangkuman = s.statements.map((st) => `${st.teks} = ${st.correctLabel}`).join("; ");
        doc.fontSize(9).fillColor("#475569").text(`Kunci: ${rangkuman}`, { width: doc.page.width - 96 });
      }
      if (s.pembahasan) {
        doc.fontSize(9).fillColor("#64748b").text(`Pembahasan: ${s.pembahasan}`, { width: doc.page.width - 96 });
      }
    }
    doc.moveDown(0.6);
  });

  doc.end();
  const pdfBuffer = await donePromise;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapor-${hasil.siswa.nama.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
