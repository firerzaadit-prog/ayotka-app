import { z } from "zod";

export const voucherPriceTierCreateSchema = z.object({
  minJumlah: z.coerce.number().int().min(1, "Jumlah minimal 1"),
  diskonPersen: z.coerce.number().int().min(0).max(100, "Diskon 0-100%"),
  label: z.string().trim().min(1, "Label wajib diisi"),
});

export const voucherPriceTierUpdateSchema = voucherPriceTierCreateSchema.partial();

export type VoucherPriceTierCreateInput = z.infer<typeof voucherPriceTierCreateSchema>;
export type VoucherPriceTierUpdateInput = z.infer<typeof voucherPriceTierUpdateSchema>;
