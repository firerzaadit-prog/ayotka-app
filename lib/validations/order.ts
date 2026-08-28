import { z } from "zod";

/** Bagian 7.3 brief: order paket try out per mata pelajaran - subjectIds
 * dikirim lewat FormData (bareng file bukti transfer), boleh pilih lebih
 * dari 1 mapel dalam satu pembayaran. servicePackageId wajib dipilih siswa.
 */
export const subjectTryOutOrderCreateSchema = z.object({
  subjectIds: z.array(z.string().uuid()).min(1, "Pilih minimal 1 mata pelajaran."),
  servicePackageId: z.string().uuid("Pilih paket layanan."),
});

/** ACC/tolak order oleh admin pusat - catatan wajib diisi saat menolak supaya siswa tahu alasannya. */
export const orderReviewSchema = z
  .object({
    action: z.enum(["setujui", "tolak"]),
    catatanAdmin: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((d) => d.action !== "tolak" || Boolean(d.catatanAdmin), {
    message: "Catatan admin wajib diisi saat menolak order.",
    path: ["catatanAdmin"],
  });
