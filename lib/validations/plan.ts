import { z } from "zod";

export const planCreateSchema = z.object({
  nama: z.string().trim().min(2, "Nama paket wajib diisi"),
  target: z.enum(["sekolah", "siswa"]),
  harga: z.coerce.number().int().min(0, "Harga tidak boleh negatif"),
  durasiHari: z.coerce.number().int().min(1, "Durasi wajib diisi"),
  kuota: z.coerce.number().int().min(1).optional().or(z.literal("")),
});

export const planUpdateSchema = planCreateSchema.partial();

export type PlanCreateInput = z.infer<typeof planCreateSchema>;
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;
