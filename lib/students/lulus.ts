import type { PrismaClient } from "@prisma/client";

/**
 * Alumni: siswa yang ditandai lulus oleh admin sekolah (Student.lulusAt). Berbeda dari menghapus siswa:
 *  - siswa TETAP ada (login, riwayat, nilai, rapor), dan nilainya tetap terhitung di analitik sekolah, sehingga
 *    sekolah bisa membandingkan antar angkatan;
 *  - kursi sekolahnya bebas: kursi (entitlement school_seat) dicabut, siswa tidak dihitung ke kuota
 *    (lib/students/create.ts hitungKursiTerpakai), dan tidak bisa mendapat kursi baru (lib/billing/entitlements.ts).
 * Langganan pribadi (invoice/voucher) siswa TIDAK disentuh. Dependensi database disuntikkan seperti
 * lib/students/hapus.ts supaya bisa diuji tanpa database.
 */
type DbLulus = Pick<PrismaClient, "student" | "entitlement" | "$transaction">;

export type HasilTandaiLulus = {
  /** ID siswa yang baru ditandai lulus. */
  ditandai: string[];
  /** Jumlah yang dilewati karena sudah lulus/dihapus. */
  dilewati: number;
};

export async function tandaiLulusMassal(db: DbLulus, ids: string[], now: Date = new Date()): Promise<HasilTandaiLulus> {
  if (ids.length === 0) return { ditandai: [], dilewati: 0 };
  return db.$transaction(async (tx) => {
    const target = await tx.student.findMany({
      where: { id: { in: ids }, lulusAt: null, deletedAt: null },
      select: { id: true },
    });
    const idTarget = target.map((t) => t.id);
    if (idTarget.length > 0) {
      await tx.student.updateMany({ where: { id: { in: idTarget } }, data: { lulusAt: now } });
      // Kursi sekolah dicabut supaya kursi bebas dan akses ujian dari sekolah berhenti; riwayat tetap.
      await tx.entitlement.updateMany({
        where: { studentId: { in: idTarget }, source: "school_seat", revokedAt: null },
        data: { revokedAt: now },
      });
    }
    return { ditandai: idTarget, dilewati: ids.length - idTarget.length };
  });
}

export type HasilBatalkanLulus = {
  /** ID siswa yang dikembalikan jadi siswa aktif. */
  dipulihkan: string[];
  /** Jumlah yang dilewati karena memang belum lulus/dihapus. */
  dilewati: number;
};

/** Membatalkan tanda lulus (salah tandai). Kursi sekolah dihidupkan lagi otomatis saat siswa mulai ujian berikutnya. */
export async function batalkanLulusMassal(db: DbLulus, ids: string[]): Promise<HasilBatalkanLulus> {
  if (ids.length === 0) return { dipulihkan: [], dilewati: 0 };
  return db.$transaction(async (tx) => {
    const target = await tx.student.findMany({
      where: { id: { in: ids }, lulusAt: { not: null }, deletedAt: null },
      select: { id: true },
    });
    const idTarget = target.map((t) => t.id);
    if (idTarget.length > 0) {
      await tx.student.updateMany({ where: { id: { in: idTarget } }, data: { lulusAt: null } });
    }
    return { dipulihkan: idTarget, dilewati: ids.length - idTarget.length };
  });
}
