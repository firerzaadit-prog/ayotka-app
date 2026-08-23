import { z } from "zod";

export const schoolAdminCreateSchema = z.object({
  schoolId: z.string().uuid(),
  email: z.string().trim().email("Email tidak valid"),
  nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
});

export type SchoolAdminCreateInput = z.infer<typeof schoolAdminCreateSchema>;
