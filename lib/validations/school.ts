import { z } from "zod";

export const schoolCreateSchema = z.object({
  nama: z.string().trim().min(3, "Nama sekolah minimal 3 karakter"),
  npsn: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "NPSN harus 8 digit angka")
    .optional()
    .or(z.literal("")),
  jenjang: z.enum(["SD", "SMP"]),
  alamat: z.string().trim().optional().or(z.literal("")),
  kuotaSiswa: z.coerce.number().int().min(1, "Kuota siswa minimal 1"),
});

export const schoolUpdateSchema = schoolCreateSchema.partial().extend({
  status: z.enum(["pending_verifikasi", "aktif", "suspend"]).optional(),
  langgananBerakhir: z.coerce.date().optional().nullable(),
});

export type SchoolCreateInput = z.infer<typeof schoolCreateSchema>;
export type SchoolUpdateInput = z.infer<typeof schoolUpdateSchema>;
