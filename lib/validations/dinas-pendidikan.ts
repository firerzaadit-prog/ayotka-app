import { z } from "zod";
import { KABUPATEN_KOTA_JATIM } from "@/lib/constants/wilayah";

export const dinasAdminCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
  instansi: z.string().trim().min(2, "Nama instansi minimal 2 karakter"),
  kabupatenKota: z
    .string()
    .refine((v) => (KABUPATEN_KOTA_JATIM as readonly string[]).includes(v), {
      message: "Pilih kota/kabupaten yang valid",
    }),
});

export type DinasAdminCreateInput = z.infer<typeof dinasAdminCreateSchema>;

export const dinasAdminUpdateSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").optional(),
  instansi: z.string().trim().min(2, "Nama instansi minimal 2 karakter").optional(),
  kabupatenKota: z
    .string()
    .refine((v) => (KABUPATEN_KOTA_JATIM as readonly string[]).includes(v), {
      message: "Pilih kota/kabupaten yang valid",
    })
    .optional(),
  status: z.enum(["aktif", "nonaktif"]).optional(),
});

export type DinasAdminUpdateInput = z.infer<typeof dinasAdminUpdateSchema>;
