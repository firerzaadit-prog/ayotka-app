import { z } from "zod";

export const blueprintCreateSchema = z.object({
  subjectId: z.string().uuid(),
  jenjang: z.enum(["SD", "SMP"]),
  tingkatList: z.array(z.coerce.number().int().min(1).max(12)).min(1, "Pilih minimal satu tingkat kelas"),
  nama: z.string().trim().min(3, "Nama kisi-kisi minimal 3 karakter"),
});

export const blueprintItemCreateSchema = z.object({
  kompetensiId: z.string().uuid(),
  tingkatKesulitan: z.enum(["mudah", "sedang", "sulit"]),
  formatSoal: z.enum(["pg", "pg_kompleks", "pg_kategori"]),
  jumlahSoal: z.coerce.number().int().min(1, "Jumlah soal minimal 1"),
});

export type BlueprintCreateInput = z.infer<typeof blueprintCreateSchema>;
export type BlueprintItemCreateInput = z.infer<typeof blueprintItemCreateSchema>;
