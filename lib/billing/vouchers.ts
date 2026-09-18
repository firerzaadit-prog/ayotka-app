import "server-only";
import { prisma } from "@/lib/db/prisma";
import { generateReadableCode } from "@/lib/utils/generate-code";

export { getVoucherDiscountPercent, computeVoucherOrderAmount } from "@/lib/billing/voucher-pricing";
export { getVoucherPriceTiers } from "@/lib/billing/voucher-price-tiers";

/** Dipakai admin pusat (generate manual) dan webhook Midtrans (VoucherOrder lunas) - satu logika unik yang sama. */
export async function generateUniqueVoucherCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReadableCode(10);
    const existing = await prisma.voucher.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Gagal membuat kode voucher unik, coba lagi.");
}

/**
 * Cuma generate kode-kode unik (baca saja, belum ditulis ke DB) - dipisah
 * dari penulisannya supaya pemanggil bisa menggabungkan INSERT-nya dengan
 * operasi lain (mis. update status VoucherOrder) dalam SATU $transaction,
 * supaya webhook Midtrans yang terkirim ulang tidak menggandakan voucher.
 */
export async function generateUniqueVoucherCodes(count: number): Promise<string[]> {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(await generateUniqueVoucherCode());
  }
  return codes;
}

export async function generateVoucherBatch(params: {
  count: number;
  planId: string;
  partnerId: string;
  generatedById: string;
  voucherOrderId?: string;
}) {
  const codes = await generateUniqueVoucherCodes(params.count);
  return prisma.$transaction(
    codes.map((code) =>
      prisma.voucher.create({
        data: {
          code,
          planId: params.planId,
          partnerId: params.partnerId,
          generatedById: params.generatedById,
          voucherOrderId: params.voucherOrderId ?? null,
        },
      }),
    ),
  );
}
