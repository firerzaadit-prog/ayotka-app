import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { assertOwnsPackage } from "@/lib/packages/scope";
import { questionUpdateSchema } from "@/lib/validations/question";
import { syncQuestionChildren } from "@/lib/soal/sync-question-children";

type RouteParams = { params: Promise<{ id: string }> };

async function loadQuestionWithAnswerCount(id: string) {
  return prisma.question.findUnique({
    where: { id },
    include: {
      options: { orderBy: { urutan: "asc" } },
      categories: { orderBy: { urutan: "asc" } },
      statements: { orderBy: { urutan: "asc" } },
      package: { select: { status: true } },
      _count: { select: { attemptAnswers: true } },
    },
  });
}

/**
 * Keputusan user (25 Sep 2026): soal yang sudah pernah dijawab siswa tetap
 * bisa diedit SELAMA paketnya tidak sedang dipublish (draft/arsip) - admin
 * cukup "Sembunyikan" paket dulu (lihat packages/[id]/unpublish), edit, lalu
 * Publish lagi. Dulu terkunci total, jadi memperbaiki pembahasan/salah ketik
 * pada soal yang sudah dijawab mustahil. Saat paket dipublish, soal yang
 * sudah dijawab tetap terkunci - itu yang melindungi ujian yang sedang
 * berjalan/hasil siswa dari perubahan diam-diam.
 */
function isLocked(q: NonNullable<Awaited<ReturnType<typeof loadQuestionWithAnswerCount>>>): boolean {
  return q._count.attemptAnswers > 0 && q.package.status === "published";
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

  return NextResponse.json({
    question,
    locked: isLocked(question),
    answeredCount: question._count.attemptAnswers,
  });
}

/**
 * Tiket 2.9 (dilonggarkan 25 Sep 2026, lihat isLocked): soal yang sudah punya
 * jawaban tersimpan (attempt_answers) hanya boleh diedit kalau paketnya tidak
 * sedang dipublish. Untuk soal yang sudah dijawab, isi diperbarui DI TEMPAT
 * (ID opsi/pernyataan/kategori dipertahankan) - menghapus lalu membuat ulang
 * akan membuat jawaban lama siswa menunjuk ID yang sudah tidak ada (dan untuk
 * PG Kategori bahkan ditolak database, relasi Restrict). Konsekuensinya
 * jumlah opsi/pernyataan tidak boleh dikurangi setelah ada yang menjawab.
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

  if (isLocked(existing)) {
    return NextResponse.json(
      {
        error:
          "Soal ini sudah pernah dijawab siswa dan paketnya sedang dipublish, jadi tidak bisa diedit. Sembunyikan paket (jadikan draft) dulu, edit, lalu Publish lagi.",
      },
      { status: 409 },
    );
  }
  const sudahDijawab = existing._count.attemptAnswers > 0;

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

  if (sudahDijawab) {
    const jumlahBaru =
      input.format === "pg_kategori" ? input.statements.length : input.options.length;
    const jumlahLama =
      input.format === "pg_kategori" ? existing.statements.length : existing.options.length;
    if (jumlahBaru < jumlahLama) {
      return NextResponse.json(
        {
          error: `Soal ini sudah pernah dijawab siswa, jumlah ${
            input.format === "pg_kategori" ? "pernyataan" : "pilihan jawaban"
          } tidak boleh dikurangi (sekarang ${jumlahLama}). Ubah isinya saja, atau buat soal baru.`,
        },
        { status: 409 },
      );
    }
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

    await syncQuestionChildren(tx, id, existing, input, sudahDijawab);

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
