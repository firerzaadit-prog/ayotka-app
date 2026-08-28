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
});

export const schoolUpdateSchema = schoolCreateSchema.partial().extend({
  status: z.enum(["pending_verifikasi", "aktif", "suspend"]).optional(),
});

export type SchoolCreateInput = z.infer<typeof schoolCreateSchema>;
export type SchoolUpdateInput = z.infer<typeof schoolUpdateSchema>;

/** Tiket 7.4: aksi admin pusat atas antrean sekolah pending dari siswa mandiri. */
export const schoolPendingActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    nama: z.string().trim().min(3, "Nama sekolah minimal 3 karakter"),
    npsn: z
      .string()
      .trim()
      .regex(/^\d{8}$/, "NPSN harus 8 digit angka")
      .optional()
      .or(z.literal("")),
    alamat: z.string().trim().optional().or(z.literal("")),
  }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("merge"), targetSchoolId: z.string().uuid() }),
]);
export type SchoolPendingActionInput = z.infer<typeof schoolPendingActionSchema>;
