import { z } from "zod";

export const assignmentCreateSchema = z
  .object({
    packageId: z.string().uuid(),
    classId: z.string().uuid(),
    mulai: z.coerce.date(),
    selesai: z.coerce.date(),
    metodeDistribusi: z.enum(["otomatis", "manual"]).default("otomatis"),
  })
  .refine((data) => data.selesai > data.mulai, {
    message: "Waktu selesai harus setelah waktu mulai.",
    path: ["selesai"],
  });

export const assignmentUpdateSchema = z.object({
  mulai: z.coerce.date().optional(),
  selesai: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>;
