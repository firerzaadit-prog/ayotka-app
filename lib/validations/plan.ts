import { z } from "zod";

/**
 * Bagian 3 dokumen rencana: plan monthly/semester dikonfigurasi admin
 * pusat (harga, durasi). Plan free/school dibuat otomatis oleh sistem
 * (lihat lib/billing/entitlements.ts) dan tidak diedit lewat form ini.
 */
/** Bagian C/G (permintaan user): fitur per plan - jatah gratis Learning Analytics & Try Out Nasional per mata pelajaran, per masa aktif langganan. */
export const planFiturInputSchema = z.object({
  aiKuotaPerMapel: z.coerce.number().int().min(0, "Tidak boleh negatif"),
  tryOutNasionalKuotaPerMapel: z.coerce.number().int().min(0, "Tidak boleh negatif"),
});

export const planCreateSchema = z.object({
  kode: z.enum(["monthly", "semester"]),
  nama: z.string().trim().min(2, "Nama plan wajib diisi (min. 2 karakter)"),
  harga: z.coerce.number().int().min(0, "Harga tidak boleh negatif"),
  durasiHari: z.coerce.number().int().min(1, "Durasi minimal 1 hari"),
  isActive: z.boolean().optional(),
  fitur: planFiturInputSchema.optional(),
});

export const planUpdateSchema = planCreateSchema.omit({ kode: true }).partial();

export type PlanCreateInput = z.infer<typeof planCreateSchema>;
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;
