import "server-only";
import { prisma } from "@/lib/db/prisma";
import { generateAnalisis, MODEL_NAME } from "@/lib/ai/gemini";
import { buildAnalisisPrompt } from "@/lib/ai/prompt";
import { PROMPT_VERSION } from "@/lib/ai/version";
import type { Attempt } from "@prisma/client";

const TIDAK_DIJAWAB = "(tidak dijawab)";

type KompetensiWithMateri = {
  kode: string;
  deskripsi: string;
  subMateri: { nama: string; materi: { nama: string } };
};

type AnswerQuestion = {
  teks: string;
  format: string;
  levelBloom: string;
  pembahasan: string | null;
  kompetensi: KompetensiWithMateri;
  options: { id: string; teks: string; isCorrect: boolean }[];
  statements: { id: string; teks: string; correctCategoryId: string }[];
  categories: { id: string; label: string }[];
};

/**
 * Resolusi jawabanJson (option_id / option_ids / {statementId: categoryId})
 * jadi teks yang bisa dibaca AI - jawabanJson mentah cuma berisi ID/UUID yang
 * tidak berarti apa-apa buat model bahasa. Dipisah dari lib/exam/hasil.ts
 * (bukan reuse buildHasil) karena analisis AI HARUS selalu lihat opsi/kunci/
 * pembahasan lengkap terlepas dari canShowPembahasan - gerbang itu murni
 * soal kapan siswa BOLEH LIHAT pembahasan di layar (anti-bocor antar siswa
 * sekelas), bukan soal kapan sistem boleh MEMPROSESNYA untuk analisis.
 */
function jawabanKeTeks(q: AnswerQuestion, jawabanJson: unknown): string {
  if (q.format === "pg") {
    const j = jawabanJson as { option_id?: string } | null;
    const opt = q.options.find((o) => o.id === j?.option_id);
    return opt ? opt.teks : TIDAK_DIJAWAB;
  }
  if (q.format === "pg_kompleks") {
    const j = jawabanJson as { option_ids?: string[] } | null;
    const chosen = q.options.filter((o) => j?.option_ids?.includes(o.id));
    return chosen.length > 0 ? chosen.map((o) => o.teks).join("; ") : TIDAK_DIJAWAB;
  }
  // pg_kategori
  const j = jawabanJson as Record<string, string> | null;
  if (!j || Object.keys(j).length === 0) return TIDAK_DIJAWAB;
  return q.statements
    .map((s) => {
      const label = q.categories.find((c) => c.id === j[s.id])?.label ?? "(kosong)";
      return `"${s.teks}" -> ${label}`;
    })
    .join("; ");
}

function kunciKeTeks(q: AnswerQuestion): string {
  if (q.format === "pg" || q.format === "pg_kompleks") {
    return q.options.filter((o) => o.isCorrect).map((o) => o.teks).join("; ");
  }
  return q.statements
    .map((s) => {
      const label = q.categories.find((c) => c.id === s.correctCategoryId)?.label ?? "-";
      return `"${s.teks}" -> ${label}`;
    })
    .join("; ");
}

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
      include: {
        kompetensi: {
          select: {
            kode: true,
            deskripsi: true,
            subMateri: { select: { nama: true, materi: { select: { nama: true } } } },
          },
        },
      },
    }),
    prisma.attemptAnswer.findMany({
      where: { attemptId: attempt.id },
      select: {
        skor: true,
        skorMaks: true,
        jawabanJson: true,
        question: {
          select: {
            teks: true,
            format: true,
            levelBloom: true,
            pembahasan: true,
            kompetensi: {
              select: {
                kode: true,
                deskripsi: true,
                subMateri: { select: { nama: true, materi: { select: { nama: true } } } },
              },
            },
            options: { select: { id: true, teks: true, isCorrect: true } },
            statements: { select: { id: true, teks: true, correctCategoryId: true } },
            categories: { select: { id: true, label: true } },
          },
        },
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
      materiNama: c.kompetensi.subMateri.materi.nama,
      subMateriNama: c.kompetensi.subMateri.nama,
      jmlBenar: c.jmlBenar,
      jmlSoal: c.jmlSoal,
      persentase: c.persentase,
    })),
    levelKognitif: Array.from(levelMap.entries()).map(([level, v]) => ({ level, ...v })),
    format: Array.from(formatMap.entries()).map(([format, v]) => ({ format, ...v })),
    // Semua soal dikirim (bukan cuma yang salah, bukan dipotong jumlah/panjang
    // teksnya) - lengkap dengan jawaban siswa vs kunci vs pembahasan, supaya
    // AI bisa menarik pola miskonsepsi yang spesifik, bukan cuma generik dari
    // judul kompetensi. Aturan "jangan mengarang angka" di prompt tetap
    // berlaku - detail per-soal ini konteks kualitatif, bukan sumber angka.
    soal: answers.map((a, i) => ({
      nomor: i + 1,
      benar: (a.skor ?? 0) >= a.skorMaks,
      teksSoal: a.question.teks,
      kompetensi: a.question.kompetensi.kode,
      materiNama: a.question.kompetensi.subMateri.materi.nama,
      subMateriNama: a.question.kompetensi.subMateri.nama,
      levelBloom: a.question.levelBloom,
      jawabanSiswa: jawabanKeTeks(a.question, a.jawabanJson),
      kunciJawaban: kunciKeTeks(a.question),
      pembahasan: a.question.pembahasan,
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
