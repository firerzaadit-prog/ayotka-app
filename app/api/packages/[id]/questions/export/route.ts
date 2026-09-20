import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { assertOwnsPackage } from "@/lib/packages/scope";
import { buildSoalWorkbook } from "@/lib/soal/excel-io";
import { loadKompetensiForSubject } from "@/lib/soal/kompetensi-ref";
import type { ExportQuestion } from "@/lib/soal/excel-format";

type RouteParams = { params: Promise<{ id: string }> };

/** Nama file aman: huruf/angka/tanda hubung saja. */
function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "paket";
}

/**
 * Unduh soal satu paket sebagai Excel (?template=1 = template kosong berisi
 * contoh + petunjuk). Format kolomnya sama persis dengan yang diterima
 * endpoint impor, jadi hasil unduhan bisa diedit lalu diunggah lagi.
 */
export async function GET(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: packageId } = await params;
  if (!(await assertOwnsPackage(user, packageId))) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  const template = new URL(request.url).searchParams.get("template") === "1";
  const pkg = await prisma.package.findUniqueOrThrow({
    where: { id: packageId },
    select: { nama: true, subjectId: true, subject: { select: { nama: true } } },
  });

  const [{ referensi }, questions] = await Promise.all([
    loadKompetensiForSubject(pkg.subjectId),
    template
      ? Promise.resolve([])
      : prisma.question.findMany({
          where: { packageId, deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: {
            kompetensi: { select: { kode: true } },
            options: { orderBy: { urutan: "asc" } },
            statements: { orderBy: { urutan: "asc" }, include: { correctCategory: { select: { label: true } } } },
          },
        }),
  ]);

  const exportQuestions: ExportQuestion[] = questions.map((q) => ({
    format: q.format,
    teks: q.teks,
    media: q.media,
    bobot: q.bobot,
    tingkatKesulitan: q.tingkatKesulitan,
    levelBloom: q.levelBloom,
    pembahasan: q.pembahasan,
    kompetensiKode: q.kompetensi.kode,
    options: q.options.map((o) => ({ teks: o.teks, media: o.media, isCorrect: o.isCorrect, urutan: o.urutan })),
    statements: q.statements.map((s) => ({
      teks: s.teks,
      media: s.media,
      urutan: s.urutan,
      correctLabel: s.correctCategory.label,
    })),
  }));

  const buffer = await buildSoalWorkbook({
    judul: `${pkg.nama} (${pkg.subject.nama})`,
    questions: exportQuestions,
    kompetensi: referensi,
    template,
  });

  const filename = template ? `template-soal-${slug(pkg.subject.nama)}.xlsx` : `soal-${slug(pkg.subject.nama)}-${slug(pkg.nama)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
