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
  /** Cuma dipakai admin_pusat (lintas sekolah) - admin_sekolah selalu diresolve dari SchoolUser, lihat resolveSchoolId. */
  schoolId: z.string().uuid().optional().or(z.literal("")),
});

export const studentUpdateSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").optional(),
  nisn: nisnSchema,
  tanggalLahir: z.coerce.date().optional(),
});

export const studentImportRowSchema = z.object({
  nama: z.string().trim().min(2, "Nama wajib diisi"),
  nisn: nisnSchema,
  tanggalLahir: z.coerce.date().optional(),
});

export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
export type StudentImportRow = z.infer<typeof studentImportRowSchema>;
