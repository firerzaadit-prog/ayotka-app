import { z } from "zod";

/** Tiket 6.3: planId dikirim lewat FormData (bareng file bukti transfer), bukan JSON. */
export const orderCreateSchema = z.object({
  planId: z.string().uuid("Pilih paket langganan."),
});

/** Tiket 6.4: ACC/tolak order oleh admin pusat - catatan wajib diisi saat menolak supaya siswa tahu alasannya. */
export const orderReviewSchema = z
  .object({
    action: z.enum(["setujui", "tolak"]),
    catatanAdmin: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((d) => d.action !== "tolak" || Boolean(d.catatanAdmin), {
    message: "Catatan admin wajib diisi saat menolak order.",
    path: ["catatanAdmin"],
  });

/**
 * Bagian 7.3 brief: order paket try out per mata pelajaran - subjectIds
 * dikirim lewat FormData (bareng file bukti transfer), boleh pilih lebih
 * dari 1 mapel dalam satu pembayaran.
 */
export const subjectTryOutOrderCreateSchema = z.object({
  subjectIds: z.array(z.string().uuid()).min(1, "Pilih minimal 1 mata pelajaran."),
});
