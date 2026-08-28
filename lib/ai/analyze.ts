import "server-only";
import { prisma } from "@/lib/db/prisma";
import { generateAnalisis, MODEL_NAME } from "@/lib/ai/gemini";
import { buildAnalisisPrompt } from "@/lib/ai/prompt";
import { PROMPT_VERSION } from "@/lib/ai/version";
import type { Attempt } from "@prisma/client";

/**
 * Tiket 5.4/5.5 (Brief Bagian 8.1): agregasi level kognitif & per-format
 * SELALU dihitung ulang di sini dari attempt_answers (bukan cache) -
 * angka yang dikirim ke AI harus sumber kebenaran yang sama dengan yang
 * dipakai finalizeAttempt/buildHasil, supaya tidak pernah berbeda dari
 * yang dilihat siswa di halaman hasil.
 */
export async function runAnalisisAi(attempt: Attempt) {
  const [student, pkg, competencyScores, answers] = await Promise.all([
    prisma.student.findUniqueOrThrow({
      where: { id: attempt.studentId },
      select: { nama: true, userId: true },
    }),
    prisma.package.findUniqueOrThrow({ where: { id: attempt.packageId }, select: { nama: true } }),
    prisma.competencyScore.findMany({
      where: { attemptId: attempt.id },
      include: { kompetensi: { select: { kode: true, deskripsi: true } } },
    }),
    prisma.attemptAnswer.findMany({
      where: { attemptId: attempt.id },
      select: { 
        skor: true, 
        skorMaks: true, 
        question: { 
          select: { 
            teks: true,
            format: true, 
            levelBloom: true,
            kompetensi: { select: { kode: true } }
          } 
        } 
      },
    }),
  ]);

  const levelMap = new Map<string, { jmlBenar: number; jmlSoal: number }>();
  const formatMap = new Map<string, { jmlBenar: number; jmlSoal: number }>();
  for (const a of answers) {
    const benar = (a.skor ?? 0) >= a.skorMaks ? 1 : 0;
    const level = levelMap.get(a.question.levelBloom) ?? { jmlBenar: 0, jmlSoal: 0 };
    level.jmlBenar += benar;
    level.jmlSoal += 1;
    levelMap.set(a.question.levelBloom, level);

    const fmt = formatMap.get(a.question.format) ?? { jmlBenar: 0, jmlSoal: 0 };
    fmt.jmlBenar += benar;
    fmt.jmlSoal += 1;
    formatMap.set(a.question.format, fmt);
  }

  const prompt = buildAnalisisPrompt({
    namaSiswa: student.nama,
    paketNama: pkg.nama,
    skorAkhir: attempt.skorAkhir ?? 0,
    kompetensi: competencyScores.map((c) => ({
      kode: c.kompetensi.kode,
      deskripsi: c.kompetensi.deskripsi,
      jmlBenar: c.jmlBenar,
      jmlSoal: c.jmlSoal,
      persentase: c.persentase,
    })),
    levelKognitif: Array.from(levelMap.entries()).map(([level, v]) => ({ level, ...v })),
    format: Array.from(formatMap.entries()).map(([format, v]) => ({ format, ...v })),
    salahDijawab: answers
      .filter((a) => (a.skor ?? 0) < a.skorMaks)
      .map((a) => ({
        teksSoal: a.question.teks,
        kompetensi: a.question.kompetensi.kode,
        levelBloom: a.question.levelBloom,
      })),
  });

  const hasil = await generateAnalisis(prompt);

  await prisma.aiAnalysis.upsert({
    where: { attemptId: attempt.id },
    create: {
      attemptId: attempt.id,
      versiPrompt: PROMPT_VERSION,
      model: MODEL_NAME,
      ringkasan: hasil.ringkasan,
      detailJson: hasil,
    },
    update: {
      versiPrompt: PROMPT_VERSION,
      model: MODEL_NAME,
      ringkasan: hasil.ringkasan,
      detailJson: hasil,
      generatedAt: new Date(),
    },
  });
  return hasil;
}
