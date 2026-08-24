import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Attempt } from "@prisma/client";

/**
 * Tiket 4.10 + Bagian 7.1 brief ("Tampil pembahasan"): siswa sekolah (Jalur
 * A) baru lihat pembahasan setelah jendela ujian ditutup (mencegah bocor ke
 * teman sekelas yang belum selesai); siswa mandiri (Jalur B) & latihan
 * tanpa penugasan langsung lihat begitu submit. package.mode_pembahasan
 * "langsung" selalu menang; "setelah_tutup" digerbang oleh assignment.selesai.
 */
export async function buildHasil(attempt: Attempt) {
  const [pkg, assignment, answers, competencyScores] = await Promise.all([
    prisma.package.findUniqueOrThrow({ where: { id: attempt.packageId } }),
    attempt.assignmentId
      ? prisma.assignment.findUnique({ where: { id: attempt.assignmentId } })
      : Promise.resolve(null),
    prisma.attemptAnswer.findMany({
      where: { attemptId: attempt.id },
      include: {
        question: {
          include: { options: { orderBy: { urutan: "asc" } }, statements: { orderBy: { urutan: "asc" } } },
        },
      },
    }),
    prisma.competencyScore.findMany({
      where: { attemptId: attempt.id },
      include: { kompetensi: { select: { kode: true, deskripsi: true } } },
    }),
  ]);

  const canShowPembahasan =
    pkg.modePembahasan === "langsung" || !assignment || assignment.selesai.getTime() < Date.now();

  const perSoal = answers.map((a) => ({
    questionId: a.questionId,
    format: a.question.format,
    teks: a.question.teks,
    media: a.question.media,
    jawabanJson: a.jawabanJson,
    skor: a.skor,
    skorMaks: a.skorMaks,
    ...(canShowPembahasan
      ? {
          pembahasan: a.question.pembahasan,
          options: a.question.options.map((o) => ({
            id: o.id,
            label: o.label,
            teks: o.teks,
            isCorrect: o.isCorrect,
          })),
          statements: a.question.statements.map((s) => ({
            id: s.id,
            teks: s.teks,
            correctCategoryId: s.correctCategoryId,
          })),
        }
      : {}),
  }));

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      skorMentah: attempt.skorMentah,
      skorAkhir: attempt.skorAkhir,
      mulaiAt: attempt.mulaiAt,
      selesaiAt: attempt.selesaiAt,
    },
    package: { nama: pkg.nama },
    canShowPembahasan,
    perSoal,
    competencyScores: competencyScores.map((c) => ({
      kode: c.kompetensi.kode,
      deskripsi: c.kompetensi.deskripsi,
      jmlBenar: c.jmlBenar,
      jmlSoal: c.jmlSoal,
      persentase: c.persentase,
    })),
  };
}
