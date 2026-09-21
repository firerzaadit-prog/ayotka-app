import "server-only";
import type { VoucherStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { bentukKodeValid, normalizeKodeReferral } from "@/lib/registrasi/referral-format";

export type HasilReferral =
  | { tipe: "siswa"; studentId: string }
  | {
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
 * Cari pemilik sebuah kode di kolom kode pendaftaran mandiri. Ada dua jenis kode:
 *  - kode referral teman (siswa), dan
 *  - kode VOUCHER dari mitra: satu kode per voucher, jadi tiap siswa mendapat kode yang berbeda.
 * Kode teman didahulukan (perilaku lama); bentuk keduanya berbeda (6 vs 10 karakter) jadi bentrok
 * hanya mungkin untuk data lama.
 */
export async function resolveKodeReferral(raw: string): Promise<HasilReferral | null> {
  const kode = normalizeKodeReferral(raw);
  if (!bentukKodeValid(kode)) return null;

  const [siswa, voucher] = await Promise.all([
    prisma.student.findUnique({ where: { referralCode: kode }, select: { id: true } }),
    prisma.voucher.findUnique({
      where: { code: kode },
      select: {
        id: true,
        status: true,
        planId: true,
        partnerId: true,
        plan: { select: { nama: true, durasiHari: true } },
        partner: { select: { nama: true } },
      },
    }),
  ]);
  if (siswa) return { tipe: "siswa", studentId: siswa.id };
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
