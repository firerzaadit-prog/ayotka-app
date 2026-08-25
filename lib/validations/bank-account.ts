import { z } from "zod";

export const bankAccountCreateSchema = z.object({
  namaBank: z.string().trim().min(2, "Nama bank wajib diisi"),
  nomorRekening: z.string().trim().min(4, "Nomor rekening wajib diisi"),
  atasNama: z.string().trim().min(2, "Nama pemilik rekening wajib diisi"),
});

export const bankAccountUpdateSchema = bankAccountCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type BankAccountCreateInput = z.infer<typeof bankAccountCreateSchema>;
export type BankAccountUpdateInput = z.infer<typeof bankAccountUpdateSchema>;
