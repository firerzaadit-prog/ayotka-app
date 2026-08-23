import { z } from "zod";

export const academicYearCreateSchema = z.object({
  nama: z.string().trim().min(4, "Nama tahun ajaran minimal 4 karakter"),
  mulai: z.coerce.date(),
  selesai: z.coerce.date(),
});

export type AcademicYearCreateInput = z.infer<typeof academicYearCreateSchema>;
