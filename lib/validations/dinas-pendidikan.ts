import { z } from "zod";

export const dinasAdminCreateSchema = z.object({
  email: z.string().trim().email("Email tidak valid"),
  nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
  instansi: z.string().trim().min(2, "Nama instansi minimal 2 karakter"),
});

export type DinasAdminCreateInput = z.infer<typeof dinasAdminCreateSchema>;
