import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { loadOwnedAttempt } from "@/lib/exam/attempt-access";
import { checkAndClaimSession } from "@/lib/exam/session-guard";
import { checkRateLimit } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

const jawabanSchema = z.object({
  questionId: z.string().uuid(),
  jawabanJson: z.union([
    z.object({ option_id: z.string() }),
    z.object({ option_ids: z.array(z.string()) }),
    z.record(z.string(), z.string()),
  ]),
  ragu: z.boolean().optional(),
  tabToken: z.string().optional(),
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

  // Tiket 8.2 (Bagian 9 brief: rate limit granular termasuk "submit jawaban").
  // Per attempt, BUKAN per IP - satu lab komputer sekolah bisa berbagi satu
  // IP publik untuk puluhan siswa ujian bersamaan, jadi limit per IP di sini
  // salah sasaran (bisa memblokir siswa lain yang sah). Auto-save sudah
  // di-debounce di client (Tiket 4.8), jadi batas ini longgar - cuma
  // menahan flood dari satu sesi yang disalahgunakan/diserang skrip.
  if (!checkRateLimit(`jawaban:${attempt.id}`, 30, 10_000)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan simpan jawaban, coba lagi sebentar lagi." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = jawabanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data jawaban tidak valid." }, { status: 400 });
  }

  if (parsed.data.tabToken && !checkAndClaimSession(attempt.id, parsed.data.tabToken)) {
    return NextResponse.json(
      { error: "SESI_DIAMBIL_ALIH", message: "Ujian ini sedang dibuka di tab/perangkat lain." },
      { status: 409 },
    );
  }

  const answer = await prisma.attemptAnswer.findUnique({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId: parsed.data.questionId } },
  });
  if (!answer) {
    return NextResponse.json({ error: "Soal tidak ditemukan di attempt ini." }, { status: 404 });
  }

  const jawaban = parsed.data.jawabanJson;
  const isKategori = !("option_id" in jawaban) && !("option_ids" in jawaban);

  // Tidak pakai $transaction interaktif di sini - Supabase pgBouncer (port 6543)
  // dalam transaction mode tidak mendukung prepared statements yang dibuat
  // Prisma untuk transaksi multi-query, menyebabkan error intermiten "prepared
  // statement does not exist" di lingkungan serverless (Vercel). Ini akar
  // masalah yang sama yang sudah diperbaiki di lib/exam/finalize.ts - lihat
  // catatan di sana. Dipanggil sequential (bukan Promise.all) supaya urutan
  // delete->create untuk attempt_answer_statements tetap konsisten.
  await prisma.attemptAnswer.update({
    where: { id: answer.id },
    data: {
      jawabanJson: jawaban,
      ragu: parsed.data.ragu ?? answer.ragu,
      answeredAt: new Date(),
    },
  });

  if (isKategori) {
    await prisma.attemptAnswerStatement.deleteMany({ where: { attemptAnswerId: answer.id } });
    const entries = Object.entries(jawaban as Record<string, string>);
    if (entries.length > 0) {
      await prisma.attemptAnswerStatement.createMany({
        data: entries.map(([statementId, categoryId]) => ({
          attemptAnswerId: answer.id,
          statementId,
          categoryId,
        })),
      });
    }
  }

  return NextResponse.json({ ok: true });
}
