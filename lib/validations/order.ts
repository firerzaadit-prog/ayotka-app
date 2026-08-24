import { z } from "zod";

/** Tiket 6.3: planId dikirim lewat FormData (bareng file bukti transfer), bukan JSON. */
export const orderCreateSchema = z.object({
  planId: z.string().uuid("Pilih paket langganan."),
});

/** Tiket 6.4: ACC/tolak order oleh admin pusat. */
export const orderReviewSchema = z.object({
  action: z.enum(["setujui", "tolak"]),
  catatanAdmin: z.string().trim().max(500).optional().or(z.literal("")),
});
