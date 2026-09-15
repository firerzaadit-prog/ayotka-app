import { z } from "zod";

/**
 * Jalur B (sekolah, Bagian 5): admin pusat mengaktifkan kursi sekolah
 * setelah transfer dikonfirmasi di luar sistem. referredByPartnerId HANYA
 * boleh diisi saat aktivasi PERTAMA kali (Bagian 4.1) - lihat pengecekan
 * urutan di app/api/admin-pusat/schools/[id]/seat/route.ts.
 */
export const schoolSeatActivateSchema = z.object({
  seatQuota: z.coerce.number().int().min(1, "Kuota kursi minimal 1"),
  validUntil: z.coerce.date({ message: "Tanggal berlaku wajib diisi" }),
  referredByPartnerId: z.string().uuid().optional().nullable(),
});
