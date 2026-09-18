import "server-only";
import { prisma } from "@/lib/db/prisma";
import { computeHargaLA } from "@/lib/billing/margin";

/** Saldo = SUM(jumlah) baris berstatus "berhasil" - dihitung langsung, bukan kolom terpisah yang bisa drift. */
export async function getSaldo(studentId: string): Promise<number> {
  const result = await prisma.saldoTransaction.aggregate({
    where: { studentId, status: "berhasil" },
    _sum: { jumlah: true },
  });
  return result._sum.jumlah ?? 0;
}

/**
 * Bagian D/G: debit saldo untuk satu Learning Analytics tambahan (jatah
 * plan sudah habis). Cek-lalu-tulis dibungkus $transaction supaya dua
 * debit yang hampir bersamaan tidak sama-sama lolos cek saldo yang sama
 * (race jarang terjadi untuk satu siswa, tapi murah untuk dicegah).
 * Mengembalikan false kalau saldo tidak cukup - TIDAK membuat baris apa pun.
 */
export async function debitSaldoUntukAnalisis(params: {
  studentId: string;
  attemptId: string;
  subjectNama: string;
  harga: number;
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const result = await tx.saldoTransaction.aggregate({
      where: { studentId: params.studentId, status: "berhasil" },
      _sum: { jumlah: true },
    });
    const saldo = result._sum.jumlah ?? 0;
    if (saldo < params.harga) return false;

    await tx.saldoTransaction.create({
      data: {
        studentId: params.studentId,
        tipe: "debit_analisis",
        status: "berhasil",
        jumlah: -params.harga,
        keterangan: `Learning Analytics - ${params.subjectNama} (attempt ${params.attemptId})`,
      },
    });
    return true;
  });
}

/** Harga jual satu Learning Analytics tambahan (harga dasar + margin), diatur admin pusat. */
export async function getHargaLearningAnalytics(): Promise<number> {
  const settings = await prisma.appSetting.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });
  const marginPersen = settings.marginLearningAnalyticsPersen ?? 0;
  return computeHargaLA(settings.hargaLearningAnalytics, marginPersen);
}
