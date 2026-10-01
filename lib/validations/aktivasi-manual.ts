import { z } from "zod";
import { SALDO_TOPUP_DENOMINASI } from "@/lib/validations/saldo";

/**
 * Aktivasi manual oleh admin pusat setelah siswa membayar lewat tautan
 * affiliate.id dan mengirim bukti via WhatsApp (lihat
 * lib/billing/pembayaran-affiliate.ts). Catatan WAJIB - ini jalur pengecualian
 * di luar pembayaran otomatis, jadi harus ada jejak bukti apa yang dicek admin.
 */
const catatan = z
  .string()
  .trim()
  .min(3, "Catatan verifikasi wajib diisi (mis. bukti bayar via WhatsApp, nomor pesanan affiliate.id)")
  .max(1000);

export const aktivasiManualSchema = z.discriminatedUnion("tipe", [
  z.object({
    tipe: z.literal("langganan"),
    studentId: z.string().uuid(),
    planId: z.string().uuid(),
    catatan,
  }),
  z.object({
    tipe: z.literal("topup"),
    studentId: z.string().uuid(),
    nominal: z
      .number()
      .int()
      .refine((n) => (SALDO_TOPUP_DENOMINASI as readonly number[]).includes(n), {
        message: "Pilih salah satu nominal top-up yang tersedia.",
      }),
    catatan,
  }),
]);

export type AktivasiManualInput = z.infer<typeof aktivasiManualSchema>;

/** Jendela deteksi klik ganda: aktivasi identik untuk siswa yang sama dalam rentang ini ditolak. */
export const JENDELA_DUPLIKAT_MS = 2 * 60 * 1000;
