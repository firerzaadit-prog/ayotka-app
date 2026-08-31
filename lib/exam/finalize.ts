import "server-only";
import { prisma } from "@/lib/db/prisma";
import { aggregateCompetency, computeSkorAkhir, scoreQuestion } from "@/lib/exam/scoring";

/**
 * Tiket 4.10/4.11: submit + skoring + agregasi kompetensi, dipakai dua
 * jalur - submit eksplisit (siswa klik Submit) dan auto-submit saat waktu
 * habis (dicek lazy di setiap request yang menyentuh attempt ini, lihat
 * lib/exam/timing.ts). Satu fungsi supaya perilakunya identik di kedua jalur.
 *
 * CATATAN: Tidak lagi menggunakan $transaction karena Supabase pgBouncer
 * (port 6543) dalam transaction mode tidak mendukung prepared statements
 * yang dibuat Prisma - menyebabkan error "prepared statement does not exist"
 * di lingkungan serverless (Vercel). Sebagai gantinya, status attempt diubah
 * terakhir sehingga kalau ada step sebelumnya yang gagal, attempt masih bisa
 * di-finalize ulang (idempotent).
 */
export async function finalizeAttempt(
  _tx: unknown, // tetap terima arg ini agar signature lama tetap kompatibel
  attemptId: string,
  finalStatus: "selesai" | "kedaluwarsa",
): Promise<void> {
  const answers = await prisma.attemptAnswer.findMany({
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

  // Score semua jawaban dan kumpulkan update-nya
  const answerUpdates: { id: string; skor: number; skorMaks: number }[] = [];
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

    answerUpdates.push({ id: answer.id, skor, skorMaks });
    skorMentah += skor;
    skorMaksTotal += skorMaks;
    perKompetensi.push({ kompetensiId: answer.question.kompetensiId, skor, skorMaks });
  }

  // Update skor per jawaban secara paralel (tanpa transaction, idempotent)
  await Promise.all(
    answerUpdates.map(({ id, skor, skorMaks }) =>
      prisma.attemptAnswer.update({
        where: { id },
        data: { skor, skorMaks },
      })
    )
  );

  const skorAkhir = computeSkorAkhir(skorMentah, skorMaksTotal);

  // Upsert competency scores secara paralel
  const aggregated = aggregateCompetency(perKompetensi);
  await Promise.all(
    aggregated.map((agg) =>
      prisma.competencyScore.upsert({
        where: { attemptId_kompetensiId: { attemptId, kompetensiId: agg.kompetensiId } },
        create: {
          attemptId,
          kompetensiId: agg.kompetensiId,
          jmlBenar: agg.jmlBenar,
          jmlSoal: agg.jmlSoal,
          persentase: agg.persentase,
        },
        update: { jmlBenar: agg.jmlBenar, jmlSoal: agg.jmlSoal, persentase: agg.persentase },
      })
    )
  );

  // Update status attempt TERAKHIR - ini menjadi sinyal bahwa finalize selesai
  await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      status: finalStatus,
      selesaiAt: new Date(),
      skorMentah,
      skorAkhir,
    },
  });
}
