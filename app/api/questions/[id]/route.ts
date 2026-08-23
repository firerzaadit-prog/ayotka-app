import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { assertOwnsPackage } from "@/lib/packages/scope";
import { questionUpdateSchema } from "@/lib/validations/question";

type RouteParams = { params: Promise<{ id: string }> };

async function loadQuestionWithAnswerCount(id: string) {
  return prisma.question.findUnique({
    where: { id },
    include: {
      options: { orderBy: { urutan: "asc" } },
      categories: { orderBy: { urutan: "asc" } },
      statements: { orderBy: { urutan: "asc" } },
      _count: { select: { attemptAnswers: true } },
    },
  });
}

export async function GET(_request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const question = await loadQuestionWithAnswerCount(id);
  if (!question || !(await assertOwnsPackage(user, question.packageId))) {
    return NextResponse.json({ error: "Soal tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ question, locked: question._count.attemptAnswers > 0 });
}

/**
 * Tiket 2.9: soal yang sudah punya jawaban tersimpan (attempt_answers)
 * tidak boleh diubah isinya sama sekali (Bagian 7.2 brief) - buat versi
 * baru lewat POST /api/packages/[id]/questions kalau perlu revisi.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await loadQuestionWithAnswerCount(id);
  if (!existing || !(await assertOwnsPackage(user, existing.packageId))) {
    return NextResponse.json({ error: "Soal tidak ditemukan." }, { status: 404 });
  }

  if (existing._count.attemptAnswers > 0) {
    return NextResponse.json(
      {
        error:
          "Soal ini sudah pernah dijawab siswa, tidak bisa diedit. Buat versi soal baru untuk perbaikan.",
      },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = questionUpdateSchema.safeParse({ ...body, packageId: existing.packageId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const input = parsed.data;

  if (input.format !== existing.format) {
    return NextResponse.json(
      { error: "Format soal tidak bisa diganti saat edit - buat soal baru." },
      { status: 400 },
    );
  }

  const question = await prisma.$transaction(async (tx) => {
    const updated = await tx.question.update({
      where: { id },
      data: {
        teks: input.teks,
        bobot: input.bobot,
        tingkatKesulitan: input.tingkatKesulitan,
        kompetensiId: input.kompetensiId,
        levelBloom: input.levelBloom,
        materiId: input.materiId && input.materiId.length > 0 ? input.materiId : null,
        subMateriId:
          input.subMateriId && input.subMateriId.length > 0 ? input.subMateriId : null,
        pembahasan: input.pembahasan && input.pembahasan.length > 0 ? input.pembahasan : null,
        media: input.media ?? null,
      },
    });

    if (input.format === "pg" || input.format === "pg_kompleks") {
      await tx.questionOption.deleteMany({ where: { questionId: id } });
      await tx.questionOption.createMany({
        data: input.options.map((opt) => ({ ...opt, questionId: id })),
      });
    }

    if (input.format === "pg_kategori") {
      await tx.questionStatement.deleteMany({ where: { questionId: id } });
      await tx.questionCategory.deleteMany({ where: { questionId: id } });

      const benar = await tx.questionCategory.create({
        data: { questionId: id, label: "Benar", urutan: 0 },
      });
      const salah = await tx.questionCategory.create({
        data: { questionId: id, label: "Salah", urutan: 1 },
      });

      await tx.questionStatement.createMany({
        data: input.statements.map((s) => ({
          questionId: id,
          teks: s.teks,
          media: s.media ?? null,
          urutan: s.urutan,
          correctCategoryId: s.correctCategory === "Benar" ? benar.id : salah.id,
        })),
      });
    }

    return updated;
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "questions",
    entitasId: id,
    before: existing,
    after: question,
    ip: getClientIp(request),
  });

  return NextResponse.json({ question });
}

/** Tiket 2.9: soft delete - soal hilang dari daftar, riwayat attempt tetap utuh. */
export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing || !(await assertOwnsPackage(user, existing.packageId))) {
    return NextResponse.json({ error: "Soal tidak ditemukan." }, { status: 404 });
  }

  const question = await prisma.question.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "questions",
    entitasId: id,
    before: existing,
    after: question,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
