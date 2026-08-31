import "server-only";
import { prisma } from "@/lib/db/prisma";
import { aggregateCompetency, computeSkorAkhir, scoreQuestion } from "@/lib/exam/scoring";

/**
 * Jalankan semua task dengan batas konkurensi, bukan Promise.all tanpa batas.
 * Paket soal bisa berisi 40-50 soal - menembak semuanya sekaligus ke Supabase
 * lewat pgBouncer serverless bisa menghabiskan pool koneksi (baik pool
 * pgBouncer maupun connection_limit Prisma sendiri yang kecil di serverless),
 * membuat sebagian update gagal/timeout pas submit ujian yang soalnya banyak.
 */
async function runWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < tasks.length) {
      const current = nextIndex++;
      const task = tasks[current];
      if (!task) continue;
      results[current] = await task();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

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

  // Update skor per jawaban paralel dengan batas konkurensi (tanpa transaction, idempoten)
  await runWithConcurrencyLimit(
    answerUpdates.map(({ id, skor, skorMaks }) => () =>
      prisma.attemptAnswer.update({
        where: { id },
        data: { skor, skorMaks },
      })
    ),
    8,
  );

  const skorAkhir = computeSkorAkhir(skorMentah, skorMaksTotal);

  // Upsert competency scores paralel dengan batas konkurensi
  const aggregated = aggregateCompetency(perKompetensi);
  await runWithConcurrencyLimit(
    aggregated.map((agg) => () =>
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
    ),
    8,
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
