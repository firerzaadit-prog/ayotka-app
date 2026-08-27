import { z } from "zod";

export const materiCreateSchema = z.object({
  subjectId: z.string().uuid(),
  tingkat: z.coerce.number().int().min(1).max(12),
  nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
  urutan: z.coerce.number().int().min(0).default(0),
});

export const subMateriCreateSchema = z.object({
  materiId: z.string().uuid(),
  nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
  urutan: z.coerce.number().int().min(0).default(0),
});

export const kompetensiCreateSchema = z.object({
  subMateriId: z.string().uuid(),
  kode: z.string().trim().min(1, "Kode wajib diisi"),
  deskripsi: z.string().trim().min(3, "Deskripsi minimal 3 karakter"),
  levelKognitif: z.enum(["L1", "L2", "L3"]),
});

export const namaUpdateSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
});

export type MateriCreateInput = z.infer<typeof materiCreateSchema>;
export type SubMateriCreateInput = z.infer<typeof subMateriCreateSchema>;
export type KompetensiCreateInput = z.infer<typeof kompetensiCreateSchema>;
