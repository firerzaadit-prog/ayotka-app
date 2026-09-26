import { z } from "zod";

export const partnerCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
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

/** Jalur C lewat Midtrans: mitra beli batch voucher sendiri (bukan admin pusat generate manual). */
export const voucherOrderCheckoutSchema = z.object({
  planId: z.string().uuid(),
  jumlah: z.number().int().min(1, "Jumlah minimal 1").max(500, "Maksimal 500 voucher per pembelian"),
});

/**
 * Bagian 9 kasus tepi #7: klaim rujukan sekolah yang telat diverifikasi -
 * dibuat manual oleh admin SETELAH verifikasi terpisah di luar sistem
 * (tidak pernah otomatis), tidak mengubah School.referredByPartnerId sama
 * sekali (itu tetap terkunci sesuai Bagian 4.1) - murni catatan komisi.
 */
export const partnerCommissionCreateSchema = z.object({
  partnerId: z.string().uuid(),
  schoolId: z.string().uuid(),
  note: z.string().trim().min(1, "Catatan verifikasi wajib diisi").max(1000),
});

export const partnerCommissionUpdateSchema = z.object({
  amount: z.number().int().min(0).optional(),
  status: z.enum(["pending", "paid"]).optional(),
  note: z.string().trim().max(1000).optional(),
});

export type PartnerCreateInput = z.infer<typeof partnerCreateSchema>;
export type VoucherGenerateInput = z.infer<typeof voucherGenerateSchema>;
export type VoucherRedeemInput = z.infer<typeof voucherRedeemSchema>;
export type VoucherOrderCheckoutInput = z.infer<typeof voucherOrderCheckoutSchema>;
export type PartnerCommissionCreateInput = z.infer<typeof partnerCommissionCreateSchema>;
export type PartnerCommissionUpdateInput = z.infer<typeof partnerCommissionUpdateSchema>;
