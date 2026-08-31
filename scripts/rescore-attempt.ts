// Re-score attempt yang finalized dengan skor 0
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const ATTEMPT_ID = "a4fac53e-fc0a-45b2-baeb-97340301a4a3";

function scoreQ(format: string, bobot: number, options: any[], statements: any[], jawaban: any) {
  if (!jawaban) return { skor: 0, skorMaks: bobot };
  if (format === "pg") {
    const correct = options.find((o: any) => o.isCorrect);
    return { skor: correct && jawaban.option_id === correct.id ? bobot : 0, skorMaks: bobot };
  }
  if (format === "pg_kompleks") {
    const correctIds = new Set(options.filter((o: any) => o.isCorrect).map((o: any) => o.id));
    const sel: string[] = jawaban.option_ids ?? [];
    const ok = sel.length === correctIds.size && sel.every((id) => correctIds.has(id));
    return { skor: ok ? bobot : 0, skorMaks: bobot };
  }
  if (format === "pg_kategori") {
    const ans = jawaban as Record<string, string>;
    const total = statements.length;
    if (!total) return { skor: 0, skorMaks: bobot };
    const correct = statements.filter((s: any) => ans[s.id] === s.correctCategoryId).length;
    return { skor: correct === total ? bobot : 0, skorMaks: bobot };
  }
  return { skor: 0, skorMaks: bobot };
}

async function main() {
  const answers = await db.attemptAnswer.findMany({
    where: { attemptId: ATTEMPT_ID },
    include: { question: { include: { options: true, statements: true } } }
  });

  console.log(`Re-scoring ${answers.length} jawaban...`);
  let skorMentah = 0, skorMaksTotal = 0;
  const kompetensiMap = new Map<string, { benar: number; total: number }>();

  for (const a of answers) {
    const { skor, skorMaks } = scoreQ(
      a.question.format, a.question.bobot,
      a.question.options, a.question.statements,
      a.jawabanJson
    );
    await db.attemptAnswer.update({ where: { id: a.id }, data: { skor, skorMaks } });
    skorMentah += skor;
    skorMaksTotal += skorMaks;

    const kId = a.question.kompetensiId;
    if (kId) {
      const g = kompetensiMap.get(kId) ?? { benar: 0, total: 0 };
      g.benar += skor >= skorMaks && skorMaks > 0 ? 1 : 0;
      g.total += 1;
      kompetensiMap.set(kId, g);
    }
  }

  const skorAkhir = skorMaksTotal > 0 ? (skorMentah / skorMaksTotal) * 100 : 0;
  await db.attempt.update({
    where: { id: ATTEMPT_ID },
    data: { skorMentah, skorAkhir }
  });

  for (const [kompetensiId, { benar, total }] of kompetensiMap.entries()) {
    await db.competencyScore.upsert({
      where: { attemptId_kompetensiId: { attemptId: ATTEMPT_ID, kompetensiId } },
      create: { attemptId: ATTEMPT_ID, kompetensiId, jmlBenar: benar, jmlSoal: total, persentase: total > 0 ? (benar/total)*100 : 0 },
      update: { jmlBenar: benar, jmlSoal: total, persentase: total > 0 ? (benar/total)*100 : 0 }
    });
  }

  console.log(`✅ Re-score selesai! skorMentah=${skorMentah}, skorMaksTotal=${skorMaksTotal}, skorAkhir=${skorAkhir.toFixed(1)}`);
}

main().catch(console.error).finally(() => db.$disconnect());
