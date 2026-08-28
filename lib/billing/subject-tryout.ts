import "server-only";
import { prisma } from "@/lib/db/prisma";

/**
 * Bagian 7.3 brief, "Paket Layanan dan Skema Penawaran": harga dan jumlah
 * try out per mata pelajaran dikonfigurasi oleh admin pusat lewat tabel
 * service_packages — bukan lagi hardcode. Siswa mandiri memilih paket
 * saat checkout; admin pusat bisa membuat beberapa paket berbeda.
 */

/** Ambil satu paket service berdasarkan id. */
export async function getServicePackage(id: string) {
  return prisma.servicePackage.findUnique({ where: { id } });
}

/** Semua paket aktif — ditampilkan di halaman checkout siswa. */
export async function listActiveServicePackages() {
  return prisma.servicePackage.findMany({
    where: { isActive: true },
    orderBy: { hargaPerMapel: "asc" },
  });
}

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
