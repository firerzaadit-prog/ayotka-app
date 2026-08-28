import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { assertOwnsPackage } from "@/lib/packages/scope";
import { questionCreateSchema } from "@/lib/validations/question";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: packageId } = await params;
  if (!(await assertOwnsPackage(user, packageId))) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  const questions = await prisma.question.findMany({
    where: { packageId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      options: { orderBy: { urutan: "asc" } },
      categories: { orderBy: { urutan: "asc" } },
      statements: { orderBy: { urutan: "asc" } },
      kompetensi: true,
    },
  });

  return NextResponse.json({ questions });
}

/** Tiket 2.4-2.6: buat soal untuk salah satu dari 3 format. */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: packageId } = await params;
  if (!(await assertOwnsPackage(user, packageId))) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = questionCreateSchema.safeParse({ ...body, packageId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const input = parsed.data;

  const question = await prisma.$transaction(async (tx) => {
    const created = await tx.question.create({
      data: {
        packageId,
        format: input.format,
        createdBy: user.id,
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
      await tx.questionOption.createMany({
        data: input.options.map((opt) => ({ ...opt, questionId: created.id })),
      });
    }

    if (input.format === "pg_kategori") {
      const benar = await tx.questionCategory.create({
        data: { questionId: created.id, label: "Benar", urutan: 0 },
      });
      const salah = await tx.questionCategory.create({
        data: { questionId: created.id, label: "Salah", urutan: 1 },
      });

      await tx.questionStatement.createMany({
        data: input.statements.map((s) => ({
          questionId: created.id,
          teks: s.teks,
          media: s.media ?? null,
          urutan: s.urutan,
          correctCategoryId: s.correctCategory === "Benar" ? benar.id : salah.id,
        })),
      });
    }

    return created;
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "questions",
    entitasId: question.id,
    after: question,
    ip: getClientIp(request),
  });

  return NextResponse.json({ question }, { status: 201 });
}
