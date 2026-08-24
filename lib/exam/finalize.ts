import "server-only";
import type { Prisma } from "@prisma/client";
import { aggregateCompetency, computeSkorAkhir, scoreQuestion } from "@/lib/exam/scoring";

/**
 * Tiket 4.10/4.11: submit + skoring + agregasi kompetensi, dipakai dua
 * jalur - submit eksplisit (siswa klik Submit) dan auto-submit saat waktu
 * habis (dicek lazy di setiap request yang menyentuh attempt ini, lihat
 * lib/exam/timing.ts). Satu fungsi supaya perilakunya identik di kedua
 * jalur.
 */
export async function finalizeAttempt(
  tx: Prisma.TransactionClient,
  attemptId: string,
  finalStatus: "selesai" | "kedaluwarsa",
): Promise<void> {
  const answers = await tx.attemptAnswer.findMany({
    where: { attemptId },
    include: {
      question: {
        include: { options: true, statements: true },
      },
    },
  });

  let skorMentah = 0;
  let skorMaksTotal = 0;
  const perKompetensi: { kompetensiId: string; skor: number; skorMaks: number }[] = [];

  for (const answer of answers) {
    const { skor, skorMaks } = scoreQuestion(
      {
        format: answer.question.format,
        bobot: answer.question.bobot,
        options: answer.question.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })),
        statements: answer.question.statements.map((s) => ({
          id: s.id,
          correctCategoryId: s.correctCategoryId,
        })),
      },
      answer.jawabanJson,
    );

    await tx.attemptAnswer.update({
      where: { id: answer.id },
      data: { skor },
    });

    skorMentah += skor;
    skorMaksTotal += skorMaks;
    perKompetensi.push({ kompetensiId: answer.question.kompetensiId, skor, skorMaks });
  }

  const skorAkhir = computeSkorAkhir(skorMentah, skorMaksTotal);

  for (const agg of aggregateCompetency(perKompetensi)) {
    await tx.competencyScore.upsert({
      where: { attemptId_kompetensiId: { attemptId, kompetensiId: agg.kompetensiId } },
      create: {
        attemptId,
        kompetensiId: agg.kompetensiId,
        jmlBenar: agg.jmlBenar,
        jmlSoal: agg.jmlSoal,
        persentase: agg.persentase,
      },
      update: { jmlBenar: agg.jmlBenar, jmlSoal: agg.jmlSoal, persentase: agg.persentase },
    });
  }

  await tx.attempt.update({
    where: { id: attemptId },
    data: {
      status: finalStatus,
      selesaiAt: new Date(),
      skorMentah,
      skorAkhir,
    },
  });
}
