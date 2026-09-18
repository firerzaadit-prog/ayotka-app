import { z } from "zod";

/** Denominasi top-up saldo tetap (mirip pola top-up e-wallet) - lebih sederhana daripada nominal bebas. */
export const SALDO_TOPUP_DENOMINASI = [25_000, 50_000, 100_000, 200_000] as const;

export const saldoTopupSchema = z.object({
  nominal: z.number().int().refine((n) => (SALDO_TOPUP_DENOMINASI as readonly number[]).includes(n), {
    message: "Pilih salah satu nominal top-up yang tersedia.",
  }),
});

export type SaldoTopupInput = z.infer<typeof saldoTopupSchema>;
