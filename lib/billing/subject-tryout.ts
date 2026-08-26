import "server-only";
import { prisma } from "@/lib/db/prisma";

/**
 * Bagian 7.3 brief, "Paket Layanan dan Skema Penawaran": Rp20.000 per mata
 * pelajaran, sudah termasuk 3x Try Out mapel itu. Angka ini konstanta tetap
 * (bukan Plan yang admin atur lewat UI) - kalau nanti perlu diubah dari
 * dashboard, itu perluasan terpisah.
 */
export const SUBJECT_TRYOUT_PRICE = 20_000;
export const SUBJECT_TRYOUT_COUNT = 3;

/** Sisa try out siswa mandiri untuk 1 mata pelajaran (0 kalau belum pernah beli). */
export async function getSubjectTryOutRemaining(userId: string, subjectId: string): Promise<number> {
  const quota = await prisma.subjectTryOutQuota.findUnique({
    where: { userId_subjectId: { userId, subjectId } },
  });
  if (!quota) return 0;
  return Math.max(0, quota.total - quota.terpakai);
}

/** Kuota semua mapel yang pernah dibeli user (buat halaman status langganan). */
export async function listSubjectTryOutQuotas(userId: string) {
  const quotas = await prisma.subjectTryOutQuota.findMany({
    where: { userId },
    include: { subject: { select: { nama: true } } },
    orderBy: { subject: { nama: "asc" } },
  });
  return quotas.map((q) => ({
    subjectId: q.subjectId,
    subjectNama: q.subject.nama,
    total: q.total,
    sisa: Math.max(0, q.total - q.terpakai),
  }));
}

export async function canStartViaSubjectQuota(userId: string, subjectId: string): Promise<boolean> {
  return (await getSubjectTryOutRemaining(userId, subjectId)) > 0;
}

/**
 * Dipanggil TEPAT SEKALI per attempt baru, HANYA kalau kuota mapel ini yang
 * jadi alasan attempt-nya boleh dimulai (bukan karena langganan aktif atau
 * jatah uji coba gratis - lihat pemanggilnya di app/api/siswa/attempts).
 */
export async function consumeSubjectTryOut(userId: string, subjectId: string): Promise<void> {
  await prisma.subjectTryOutQuota.update({
    where: { userId_subjectId: { userId, subjectId } },
    data: { terpakai: { increment: 1 } },
  });
}
