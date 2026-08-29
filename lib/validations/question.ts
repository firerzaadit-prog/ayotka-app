import { z } from "zod";

export const packageCreateSchema = z.object({
  subjectId: z.string().uuid(),
  nama: z.string().trim().min(3, "Nama paket minimal 3 karakter"),
  jenjang: z.enum(["SD", "SMP"]),
  tingkat: z.coerce.number().int().min(1).max(12),
  durasiMenit: z.coerce.number().int().min(1, "Durasi wajib diisi"),
  jumlahSoal: z.coerce.number().int().min(1, "Jumlah soal wajib diisi"),
  blueprintId: z.string().uuid().optional().or(z.literal("")),
  grupParalelId: z.string().uuid().optional().or(z.literal("")),
  modePembahasan: z.enum(["langsung", "setelah_tutup"]).optional(),
  bolehDipilihSiswa: z.boolean().optional(),
  targetSiswa: z.enum(["sekolah", "mandiri", "semua"]).optional(),
});
export type PackageCreateInput = z.infer<typeof packageCreateSchema>;

const optionSchema = z.object({
  label: z.string().trim().min(1),
  teks: z.string().trim().min(1, "Teks opsi wajib diisi"),
  media: z.string().nullish(),
  isCorrect: z.boolean(),
  urutan: z.number().int(),
});

const baseQuestionFields = {
  packageId: z.string().uuid(),
  teks: z.string().trim().min(1, "Teks soal wajib diisi"),
  media: z.string().nullish(),
  bobot: z.coerce.number().int().min(1).default(1),
  tingkatKesulitan: z.enum(["mudah", "sedang", "sulit"]),
  materiId: z.string().uuid().optional().or(z.literal("")),
  subMateriId: z.string().uuid().optional().or(z.literal("")),
  kompetensiId: z.string().uuid(),
  levelBloom: z.enum(["L1", "L2", "L3"]),
  pembahasan: z.string().optional().or(z.literal("")),
};

const pgSchema = z.object({
  ...baseQuestionFields,
  format: z.literal("pg"),
  options: z
    .array(optionSchema)
    .min(4, "Format PG wajib 4-5 opsi")
    .max(5, "Format PG wajib 4-5 opsi")
    .refine(
      (opts) => opts.filter((o) => o.isCorrect).length === 1,
      "PG harus punya tepat 1 jawaban benar",
    ),
});

const pgKompleksSchema = z.object({
  ...baseQuestionFields,
  format: z.literal("pg_kompleks"),
  options: z
    .array(optionSchema)
    .min(2, "Minimal 2 opsi")
    .max(8, "Maksimal 8 opsi")
    .refine(
      (opts) => opts.filter((o) => o.isCorrect).length >= 1,
      "PG Kompleks harus punya minimal 1 jawaban benar",
    ),
});

const statementSchema = z.object({
  teks: z.string().trim().min(1, "Teks pernyataan wajib diisi"),
  media: z.string().nullish(),
  correctCategory: z.enum(["Benar", "Salah"]),
  urutan: z.number().int(),
});

const pgKategoriSchema = z.object({
  ...baseQuestionFields,
  format: z.literal("pg_kategori"),
  statements: z
    .array(statementSchema)
    .min(1, "Minimal 1 pernyataan")
    .max(3, "PG Kategori maksimal 3 pernyataan per soal"),
});

export const questionCreateSchema = z.discriminatedUnion("format", [
  pgSchema,
  pgKompleksSchema,
  pgKategoriSchema,
]);
export type QuestionCreateInput = z.infer<typeof questionCreateSchema>;

export const questionUpdateSchema = questionCreateSchema;
