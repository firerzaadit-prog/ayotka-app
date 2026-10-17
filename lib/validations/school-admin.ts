import { z } from "zod";

export const schoolAdminCreateSchema = z.object({
  schoolId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
  /// Kirim detail login ke email akun lewat SMTP (Gmail). Bawaan: ya.
  kirimEmail: z.boolean().optional(),
});

export type SchoolAdminCreateInput = z.infer<typeof schoolAdminCreateSchema>;
