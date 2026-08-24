import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { loadOwnedAttempt } from "@/lib/exam/attempt-access";
import { getRemainingSeconds } from "@/lib/exam/timing";
import { shuffleWithSeed } from "@/lib/exam/shuffle";
import { buildHasil } from "@/lib/exam/hasil";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Tiket 4.4/4.5-4.7: soal untuk halaman pengerjaan. Bagian 9 brief:
 * "kunci jawaban tidak pernah dikirim ke browser sebelum ujian selesai" -
 * is_correct, correct_category_id, dan pembahasan SENGAJA tidak pernah
 * disertakan di sini selama status masih berjalan/paused.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const attempt = await loadOwnedAttempt(user.id, id);
  if (!attempt) {
    return NextResponse.json({ error: "Attempt tidak ditemukan." }, { status: 404 });
  }

  if (attempt.status === "paused") {
    return NextResponse.json({ attempt, questions: [], answers: [] });
  }

  if (attempt.status === "selesai" || attempt.status === "kedaluwarsa") {
    return NextResponse.json(await buildHasil(attempt));
  }

  const [pkg, questions, answers] = await Promise.all([
    prisma.package.findUniqueOrThrow({ where: { id: attempt.packageId } }),
    prisma.question.findMany({
      where: { packageId: attempt.packageId, deletedAt: null },
      include: {
        options: { orderBy: { urutan: "asc" } },
        categories: { orderBy: { urutan: "asc" } },
        statements: { orderBy: { urutan: "asc" } },
      },
    }),
    prisma.attemptAnswer.findMany({ where: { attemptId: attempt.id } }),
  ]);

  const orderedQuestions = pkg.acakSoal ? shuffleWithSeed(questions, `${attempt.id}:soal`) : questions;

  const sanitizedQuestions = orderedQuestions.map((q) => {
    const options = pkg.acakOpsi
      ? shuffleWithSeed(q.options, `${attempt.id}:opsi:${q.id}`)
      : q.options;
    return {
      id: q.id,
      format: q.format,
      teks: q.teks,
      media: q.media,
      bobot: q.bobot,
      options: options.map((o) => ({ id: o.id, label: o.label, teks: o.teks, media: o.media })),
      categories: q.categories.map((c) => ({ id: c.id, label: c.label })),
      statements: shuffleWithSeed(q.statements, `${attempt.id}:baris:${q.id}`).map((s) => ({
        id: s.id,
        teks: s.teks,
        media: s.media,
      })),
    };
  });

  return NextResponse.json({
    attempt: { ...attempt, sisaDetik: getRemainingSeconds(attempt) },
    package: { nama: pkg.nama, durasiMenit: pkg.durasiMenit },
    questions: sanitizedQuestions,
    answers: answers.map((a) => ({
      questionId: a.questionId,
      jawabanJson: a.jawabanJson,
      ragu: a.ragu,
    })),
  });
}
