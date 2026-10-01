import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Student } from "@prisma/client";
import { getActiveEntitlement, hasUsedFreeTrial } from "@/lib/billing/entitlements";
import { getAiKuotaRemaining } from "@/lib/billing/plan-fitur";
import { getHargaLearningAnalytics, getSaldo } from "@/lib/billing/saldo";
import type { TipeAkses } from "@/lib/billing/learning-analytics";

export type RingkasanAksesUjian = {
  tipe: TipeAkses;
  mapel: string;
  /** Hanya untuk tipe "gratis": jatah 1x ujian per mata pelajaran sudah dipakai atau belum. */
  jatahGratis: { terpakai: boolean } | null;
  /** null untuk tipe "sekolah" (ditanggung sekolah, tanpa jatah/saldo). */
  learningAnalytics: {
    harga: number;
    saldo: number;
    /** Jatah LA gratis dari paket langganan untuk mapel ini; null untuk paket gratis. */
    kuota: { sisa: number; total: number } | null;
  } | null;
};

/**
 * Tipe akses siswa SEKARANG, tanpa efek samping (beda dari canStartAttempt yang
 * diam-diam membuat kursi sekolah) - dipakai halaman instruksi ujian untuk
 * menampilkan keterangan paket gratis & pilihan Learning Analytics.
 * Kursi sekolah yang belum dibuat tapi masih tersedia dihitung "sekolah",
 * karena akan dibuat otomatis begitu siswa menekan Mulai.
 */
export async function getTipeAkses(student: Student): Promise<TipeAkses> {
  const active = await getActiveEntitlement(student.id);
  if (active?.canStartNewAttempt) {
    return active.entitlement.source === "school_seat" ? "sekolah" : "langganan";
  }

  if (student.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: student.schoolId },
      select: { seatQuota: true, validUntil: true },
    });
    if (school?.seatQuota != null && school.validUntil && school.validUntil > new Date()) {
      const terpakai = await prisma.entitlement.count({
        where: { schoolId: student.schoolId, source: "school_seat", revokedAt: null, student: { deletedAt: null } },
      });
      if (terpakai < school.seatQuota) return "sekolah";
    }
  }
  return "gratis";
}

export async function getRingkasanAksesUjian(
  student: Student,
  subject: { id: string; nama: string },
): Promise<RingkasanAksesUjian> {
  const tipe = await getTipeAkses(student);

  const jatahGratis = tipe === "gratis" ? { terpakai: await hasUsedFreeTrial(student.id, subject.id) } : null;
  if (tipe === "sekolah") {
    return { tipe, mapel: subject.nama, jatahGratis: null, learningAnalytics: null };
  }

  const [saldo, harga, kuota] = await Promise.all([
    getSaldo(student.id),
    getHargaLearningAnalytics(),
    tipe === "langganan" ? getAiKuotaRemaining(student.id, subject.id) : Promise.resolve(null),
  ]);

  return {
    tipe,
    mapel: subject.nama,
    jatahGratis,
    learningAnalytics: { harga, saldo, kuota },
  };
}
