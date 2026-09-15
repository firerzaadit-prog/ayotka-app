import { z } from "zod";

export const partnerCreateSchema = z.object({
  email: z.string().trim().email("Email tidak valid"),
  nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
  kontak: z.string().trim().min(1, "Kontak wajib diisi").optional(),
});

export const voucherGenerateSchema = z.object({
  partnerId: z.string().uuid(),
  planId: z.string().uuid(),
  jumlah: z.number().int().min(1, "Jumlah minimal 1").max(500, "Maksimal 500 voucher per batch"),
});

export const voucherRedeemSchema = z.object({
  code: z.string().trim().min(1, "Kode voucher wajib diisi"),
});

export type PartnerCreateInput = z.infer<typeof partnerCreateSchema>;
export type VoucherGenerateInput = z.infer<typeof voucherGenerateSchema>;
export type VoucherRedeemInput = z.infer<typeof voucherRedeemSchema>;
