import "server-only";
import type { Prisma } from "@prisma/client";
import type { QuestionCreateInput } from "@/lib/validations/question";

type ExistingChildren = {
  options: { id: string }[];
  categories: { id: string; label: string }[];
  statements: { id: string }[];
};

/**
 * Sinkronkan opsi (PG/PG Kompleks) atau pernyataan+kategori (PG Kategori)
 * sebuah soal dengan input hasil edit - dipanggil di dalam transaksi
 * PATCH /api/questions/[id].
 *
 * dijawab = false (belum pernah dijawab siswa): hapus lalu buat ulang, cara
 * lama - sederhana dan aman karena tidak ada yang merujuk ID-nya.
 *
 * dijawab = true: perbarui DI TEMPAT (ID dipertahankan). Jawaban siswa yang
 * sudah tersimpan merujuk ID opsi (jawabanJson.option_id/option_ids) dan
 * ID pernyataan+kategori (AttemptAnswerStatement) - dibuat ulang berarti
 * hasil siswa lama menunjuk ke ID yang sudah tidak ada, dan untuk pernyataan
 * ditolak database (relasi onDelete: Restrict). Form edit tidak mengirim ID,
 * jadi item dicocokkan berdasarkan urutan tampil. Pemanggil WAJIB sudah
 * memastikan jumlah item tidak berkurang (item berlebih tidak dihapus di sini).
 */
export async function syncQuestionChildren(
  tx: Prisma.TransactionClient,
  questionId: string,
  existing: ExistingChildren,
  input: QuestionCreateInput,
  dijawab: boolean,
): Promise<void> {
  if (input.format === "pg" || input.format === "pg_kompleks") {
    if (!dijawab) {
      await tx.questionOption.deleteMany({ where: { questionId } });
      await tx.questionOption.createMany({
        data: input.options.map((opt) => ({ ...opt, questionId })),
      });
      return;
    }

    const baru = [...input.options].sort((a, b) => a.urutan - b.urutan);
    for (let i = 0; i < baru.length; i++) {
      const opt = baru[i]!;
      const data = {
        label: opt.label,
        teks: opt.teks,
        media: opt.media ?? null,
        isCorrect: opt.isCorrect,
        urutan: opt.urutan,
      };
      const lama = existing.options[i];
      if (lama) await tx.questionOption.update({ where: { id: lama.id }, data });
      else await tx.questionOption.create({ data: { ...data, questionId } });
    }
    return;
  }

  // pg_kategori
  if (!dijawab) {
    await tx.questionStatement.deleteMany({ where: { questionId } });
    await tx.questionCategory.deleteMany({ where: { questionId } });

    const benar = await tx.questionCategory.create({
      data: { questionId, label: "Benar", urutan: 0 },
    });
    const salah = await tx.questionCategory.create({
      data: { questionId, label: "Salah", urutan: 1 },
    });

    await tx.questionStatement.createMany({
      data: input.statements.map((s) => ({
        questionId,
        teks: s.teks,
        media: s.media ?? null,
        urutan: s.urutan,
        correctCategoryId: s.correctCategory === "Benar" ? benar.id : salah.id,
      })),
    });
    return;
  }

  // Kategori Benar/Salah dipertahankan (AttemptAnswerStatement.categoryId
  // menunjuk ke sini); dibuat hanya kalau salah satunya ternyata belum ada.
  const kategoriIds = new Map(existing.categories.map((c) => [c.label, c.id] as const));
  for (const [label, urutan] of [
    ["Benar", 0],
    ["Salah", 1],
  ] as const) {
    if (!kategoriIds.has(label)) {
      const dibuat = await tx.questionCategory.create({ data: { questionId, label, urutan } });
      kategoriIds.set(label, dibuat.id);
    }
  }

  const baru = [...input.statements].sort((a, b) => a.urutan - b.urutan);
  for (let i = 0; i < baru.length; i++) {
    const s = baru[i]!;
    const data = {
      teks: s.teks,
      media: s.media ?? null,
      urutan: s.urutan,
      correctCategoryId: kategoriIds.get(s.correctCategory)!,
    };
    const lama = existing.statements[i];
    if (lama) await tx.questionStatement.update({ where: { id: lama.id }, data });
    else await tx.questionStatement.create({ data: { ...data, questionId } });
  }
}
