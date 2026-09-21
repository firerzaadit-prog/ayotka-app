import "server-only";
import type { Prisma } from "@prisma/client";
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

export class VoucherSudahDipakaiError extends Error {
  constructor() {
    super("VOUCHER_ALREADY_USED");
    this.name = "VoucherSudahDipakaiError";
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Aktifkan satu voucher untuk satu siswa (dipakai penukaran di menu Langganan DAN pendaftaran
 * mandiri): tandai voucher terpakai, buat entitlement (tanpa invoice - siswa tidak membayar,
 * mitra yang sudah membayar), dan catat siswa berasal dari mitra pemilik voucher.
 * Harus dipanggil di dalam transaksi pemanggil. Kalau voucher keburu dipakai orang lain
 * (balapan), melempar VoucherSudahDipakaiError sehingga seluruh transaksi pemanggil batal.
 */
export async function activateVoucher(
  tx: Prisma.TransactionClient,
  params: { voucherId: string; planId: string; partnerId: string; durasiHari: number | null; studentId: string },
) {
  const updated = await tx.voucher.updateMany({
    where: { id: params.voucherId, status: "unused" },
    data: { status: "used", usedByStudentId: params.studentId, usedAt: new Date() },
  });
  if (updated.count === 0) throw new VoucherSudahDipakaiError();

  // Jangan menimpa asal yang sudah tercatat (mis. siswa yang daftar lewat kode mitra lain).
  await tx.student.updateMany({
    where: { id: params.studentId, referredByPartnerId: null },
    data: { referredByPartnerId: params.partnerId },
  });

  const startsAt = new Date();
  return tx.entitlement.create({
    data: {
      studentId: params.studentId,
      planId: params.planId,
      startsAt,
      endsAt: addDays(startsAt, params.durasiHari ?? 30),
      source: "voucher",
      voucherId: params.voucherId,
    },
  });
}
