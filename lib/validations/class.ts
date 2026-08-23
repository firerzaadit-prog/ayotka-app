import { z } from "zod";

export const classCreateSchema = z.object({
  schoolId: z.string().uuid().optional(),
  tingkat: z.coerce.number().int().min(1).max(12),
  namaRombel: z.string().trim().min(1, "Nama rombel wajib diisi"),
  waliKelasId: z.string().uuid().optional().or(z.literal("")),
});

export const classUpdateSchema = z.object({
  namaRombel: z.string().trim().min(1, "Nama rombel wajib diisi").optional(),
  waliKelasId: z.string().uuid().optional().or(z.literal("")),
});

export type ClassCreateInput = z.infer<typeof classCreateSchema>;
export type ClassUpdateInput = z.infer<typeof classUpdateSchema>;
