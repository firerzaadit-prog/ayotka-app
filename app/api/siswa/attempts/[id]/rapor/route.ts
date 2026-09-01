import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db/prisma";
import { requireRole, type CurrentUser } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { loadOwnedAttempt } from "@/lib/exam/attempt-access";
import { buildHasil } from "@/lib/exam/hasil";
import { fetchImageBuffer, renderRaporPdf } from "@/lib/pdf/rapor-renderer";
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

  const aiAnalysis = await prisma.aiAnalysis.findUnique({
    where: { attemptId: attempt.id },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const logoBuffer = appUrl ? await fetchImageBuffer(`${appUrl}/logo.png`) : null;

  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  await renderRaporPdf(
    doc,
    hasil,
    aiAnalysis as unknown as Parameters<typeof renderRaporPdf>[2],
    logoBuffer,
  );

  doc.end();
  const pdfBuffer = await donePromise;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapor-${hasil.siswa.nama.replace(/\s+/g, "-")}.pdf"`,
      // PDF dirender ulang dari DB tiap request (termasuk aiAnalysis terbaru) -
      // no-store supaya klik "Unduh Rapor" lagi tidak disajikan dari cache
      // browser dengan analisis AI yang sudah usang.
      "Cache-Control": "no-store",
    },
  });
}
