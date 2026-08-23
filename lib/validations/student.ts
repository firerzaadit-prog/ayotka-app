import { z } from "zod";

const nisnSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/, "NISN harus 10 digit angka")
  .optional()
  .or(z.literal(""));

export const studentCreateSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
  nisn: nisnSchema,
  tanggalLahir: z.coerce.date().optional(),
  classId: z.string().uuid(),
});

export const studentUpdateSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").optional(),
  nisn: nisnSchema,
  tanggalLahir: z.coerce.date().optional(),
  classId: z.string().uuid().optional(),
});

export const studentImportRowSchema = z.object({
  nama: z.string().trim().min(2, "Nama wajib diisi"),
  nisn: nisnSchema,
  tingkat: z.coerce.number().int().min(1).max(12),
  rombel: z.string().trim().min(1, "Rombel wajib diisi"),
  tanggalLahir: z.coerce.date().optional(),
});

export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
export type StudentImportRow = z.infer<typeof studentImportRowSchema>;
