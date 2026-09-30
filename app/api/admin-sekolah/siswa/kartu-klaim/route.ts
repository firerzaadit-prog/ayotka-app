import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";

/** Tiket 3.5: cetak PDF kartu kode klaim untuk semua siswa yang belum klaim di satu sekolah. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const requestedSchoolId = new URL(request.url).searchParams.get("schoolId");
  const schoolId = await resolveSchoolId(user, requestedSchoolId);
  if (!schoolId) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 400 });
  }

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  const students = await prisma.student.findMany({
    where: { schoolId, deletedAt: null, claimStatus: "belum_klaim" },
    orderBy: { nama: "asc" },
  });

  if (students.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada siswa yang belum klaim di sekolah ini." },
      { status: 400 },
    );
  }

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const cardHeight = 110;
  const cardWidth = doc.page.width - 80;
  let y = 40;

  for (const student of students) {
    if (y + cardHeight > doc.page.height - 40) {
      doc.addPage();
      y = 40;
    }

    doc.roundedRect(40, y, cardWidth, cardHeight, 6).stroke("#cbd5e1");
    doc
      .fontSize(10)
      .fillColor("#64748b")
      .text(`${school.nama} - Kartu Klaim Akun AyoTKA`, 56, y + 14);
    doc.fontSize(16).fillColor("#0f172a").text(student.nama, 56, y + 30);
    doc
      .fontSize(9)
      .fillColor("#64748b")
      .text(`Kode Sekolah: ${school.kodeSekolah}`, 56, y + 56);
    doc.fontSize(9).text("Kode Klaim:", 56, y + 72);
    doc
      .fontSize(20)
      .fillColor("#1d4ed8")
      .text(student.claimToken ?? "-", 130, y + 66, { characterSpacing: 2 });
    doc
      .fontSize(8)
      .fillColor("#94a3b8")
      .text(
        "Daftar di ayotka.id -> pilih Jalur A -> masukkan Kode Sekolah, cari namamu, lalu masukkan Kode Klaim ini.",
        56,
        y + 92,
        { width: cardWidth - 32 },
      );

    y += cardHeight + 12;
  }

  doc.end();
  const pdfBuffer = await donePromise;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kartu-klaim-${school.kodeSekolah}.pdf"`,
    },
  });
}
