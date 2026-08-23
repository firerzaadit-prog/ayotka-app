import { z } from "zod";

export const visibilityUpdateSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("privat") }),
  z.object({ mode: z.literal("semua") }),
  z.object({ mode: z.literal("publik") }),
  z.object({ mode: z.literal("sekolah"), schoolIds: z.array(z.string().uuid()).min(1) }),
]);
export type VisibilityUpdateInput = z.infer<typeof visibilityUpdateSchema>;
