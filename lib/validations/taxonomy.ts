import { z } from "zod";

export const elemenCreateSchema = z.object({
  subjectId: z.string().uuid(),
  nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
  urutan: z.coerce.number().int().min(0).default(0),
});

export const kompetensiCreateSchema = z.object({
  elemenId: z.string().uuid(),
  subElemen: z.string().trim().min(2, "Sub elemen minimal 2 karakter"),
  deskripsi: z.string().trim().min(3, "Deskripsi minimal 3 karakter"),
  levelKognitif: z.enum(["L1", "L2", "L3"]),
});

export const namaUpdateSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
});

export type ElemenCreateInput = z.infer<typeof elemenCreateSchema>;
export type KompetensiCreateInput = z.infer<typeof kompetensiCreateSchema>;
