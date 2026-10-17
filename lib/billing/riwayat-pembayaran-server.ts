import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getSaldo } from "@/lib/billing/saldo";
import { susunRiwayatPembayaran, type ItemRiwayat } from "@/lib/billing/riwayat-pembayaran";

/** Batas baris per sumber yang dibaca; riwayat siswa biasa jauh di bawah ini (mis. puluhan analisis dalam setahun). */
export const BATAS_BARIS_PER_SUMBER = 200;

/**
 * Riwayat pembayaran satu siswa + saldonya. Tiga query paralel (tagihan paket, mutasi saldo, voucher yang ditukar),
 * digabung oleh susunRiwayatPembayaran. Voucher dibaca bersama masa berlaku entitlement-nya (satu voucher = satu
 * entitlement) supaya baris voucher memuat "berlaku sampai".
 */
export async function muatRiwayatPembayaran(studentId: string, now: Date = new Date()): Promise<{ item: ItemRiwayat[]; saldo: number; terpotong: boolean }> {
  const [invoice, saldoTx, voucher, saldo] = await Promise.all([
    prisma.invoice.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: BATAS_BARIS_PER_SUMBER,
      select: { id: true, amount: true, status: true, paymentChannel: true, createdAt: true, expiresAt: true, plan: { select: { nama: true } } },
    }),
    prisma.saldoTransaction.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: BATAS_BARIS_PER_SUMBER,
      select: { id: true, tipe: true, status: true, jumlah: true, keterangan: true, paymentChannel: true, createdAt: true, expiresAt: true },
    }),
    prisma.voucher.findMany({
      where: { usedByStudentId: studentId },
      orderBy: { usedAt: "desc" },
      take: BATAS_BARIS_PER_SUMBER,
      select: {
        id: true,
        code: true,
        usedAt: true,
        plan: { select: { nama: true } },
        entitlements: { where: { studentId, revokedAt: null }, select: { endsAt: true }, orderBy: { endsAt: "desc" }, take: 1 },
      },
    }),
    getSaldo(studentId),
  ]);

  const item = susunRiwayatPembayaran(
    {
      invoice,
      saldo: saldoTx,
      voucher: voucher.map((v) => ({
        id: v.id,
        code: v.code,
        usedAt: v.usedAt,
        plan: v.plan,
        berlakuSampai: v.entitlements[0]?.endsAt ?? null,
      })),
    },
    now,
  );
  const terpotong = invoice.length >= BATAS_BARIS_PER_SUMBER || saldoTx.length >= BATAS_BARIS_PER_SUMBER || voucher.length >= BATAS_BARIS_PER_SUMBER;
  return { item, saldo, terpotong };
}
