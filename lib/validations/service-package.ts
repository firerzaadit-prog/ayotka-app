import { z } from "zod";

/**
 * Bagian 7.3 brief: paket layanan TKA dikonfigurasi admin pusat.
 * Setiap paket punya nama, harga per mapel, dan jumlah try out per mapel.
 */
export const servicePackageCreateSchema = z.object({
  nama: z.string().trim().min(2, "Nama paket wajib diisi (min. 2 karakter)"),
  hargaPerMapel: z.coerce
    .number()
    .int()
    .min(0, "Harga tidak boleh negatif"),
  tryOutPerMapel: z.coerce
    .number()
    .int()
    .min(1, "Jumlah try out minimal 1"),
  deskripsi: z.string().trim().max(500).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const servicePackageUpdateSchema = servicePackageCreateSchema.partial();

export type ServicePackageCreateInput = z.infer<typeof servicePackageCreateSchema>;
export type ServicePackageUpdateInput = z.infer<typeof servicePackageUpdateSchema>;
