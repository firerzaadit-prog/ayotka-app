import "server-only";
import type { VoucherStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { bentukKodeValid, normalizeKodeReferral } from "@/lib/registrasi/referral-format";

export type HasilReferral = {
  tipe: "voucher";
  voucherId: string;
  status: VoucherStatus;
  planId: string;
  planNama: string;
  durasiHari: number | null;
  partnerId: string;
  mitraNama: string;
};

/**
 * Cari pemilik sebuah kode di kolom kode pendaftaran mandiri.
 * Kode yang diterima hanya kode VOUCHER dari mitra (satu kode per voucher).
 * Kode referral antar-siswa sudah dihapus (17 Okt 2026).
 */
export async function resolveKodeReferral(raw: string): Promise<HasilReferral | null> {
  const kode = normalizeKodeReferral(raw);
  if (!bentukKodeValid(kode)) return null;

  const voucher = await prisma.voucher.findUnique({
    where: { code: kode },
    select: {
      id: true,
      status: true,
      planId: true,
      partnerId: true,
      plan: { select: { nama: true, durasiHari: true } },
      partner: { select: { nama: true } },
    },
  });
  if (voucher) {
    return {
      tipe: "voucher",
      voucherId: voucher.id,
      status: voucher.status,
      planId: voucher.planId,
      planNama: voucher.plan.nama,
      durasiHari: voucher.plan.durasiHari,
      partnerId: voucher.partnerId,
      mitraNama: voucher.partner.nama,
    };
  }
  return null;
}
