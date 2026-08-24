import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { loadOwnedAttempt } from "@/lib/exam/attempt-access";

type RouteParams = { params: Promise<{ id: string }> };

const jawabanSchema = z.object({
  questionId: z.string().uuid(),
  jawabanJson: z.union([
    z.object({ option_id: z.string() }),
    z.object({ option_ids: z.array(z.string()) }),
    z.record(z.string(), z.string()),
  ]),
  ragu: z.boolean().optional(),
});

/** Tiket 4.8: auto-save satu jawaban (dipanggil debounced dari client). */
export async function PUT(request: Request, { params }: RouteParams) {
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
  if (attempt.status !== "berjalan") {
    return NextResponse.json({ error: "Sesi ujian ini sudah tidak aktif." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = jawabanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data jawaban tidak valid." }, { status: 400 });
  }

  const answer = await prisma.attemptAnswer.findUnique({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId: parsed.data.questionId } },
  });
  if (!answer) {
    return NextResponse.json({ error: "Soal tidak ditemukan di attempt ini." }, { status: 404 });
  }

  const jawaban = parsed.data.jawabanJson;
  const isKategori = !("option_id" in jawaban) && !("option_ids" in jawaban);

  await prisma.$transaction(async (tx) => {
    await tx.attemptAnswer.update({
      where: { id: answer.id },
      data: {
        jawabanJson: jawaban,
        ragu: parsed.data.ragu ?? answer.ragu,
        answeredAt: new Date(),
      },
    });

    if (isKategori) {
      await tx.attemptAnswerStatement.deleteMany({ where: { attemptAnswerId: answer.id } });
      const entries = Object.entries(jawaban as Record<string, string>);
      if (entries.length > 0) {
        await tx.attemptAnswerStatement.createMany({
          data: entries.map(([statementId, categoryId]) => ({
            attemptAnswerId: answer.id,
            statementId,
            categoryId,
          })),
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
