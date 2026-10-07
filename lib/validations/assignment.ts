import { z } from "zod";
import { waktuWIB } from "@/lib/validations/waktu";

// mulai/selesai datang dari <input type="datetime-local"> (tanpa zona) dan dibaca sebagai WIB - lihat lib/validations/waktu.ts.
export const assignmentCreateSchema = z
  .object({
    packageId: z.string().uuid("Paket soal tidak valid."),
    mulai: waktuWIB,
    selesai: waktuWIB,
  })
  .refine((data) => data.selesai > data.mulai, {
    message: "Waktu selesai harus setelah waktu mulai.",
    path: ["selesai"],
  });

export const assignmentUpdateSchema = z
  .object({
    mulai: waktuWIB.optional(),
    selesai: waktuWIB.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.mulai !== undefined || data.selesai !== undefined || data.isActive !== undefined, {
    message: "Tidak ada yang diubah.",
  });

export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>;
