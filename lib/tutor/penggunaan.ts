import "server-only";
import { prisma } from "@/lib/db/prisma";
import { startOfDayWIB, tanggalWIB } from "@/lib/utils/datetime";
import { BATAS_HARIAN_BAWAAN } from "@/lib/tutor/konstanta";

/** Batas pesan per siswa per hari (hari WIB): env TUTOR_AI_BATAS_HARIAN (bilangan bulat >= 1), bawaan 20. */
export function batasHarianTutor(): number {
  const dariEnv = Number.parseInt(process.env.TUTOR_AI_BATAS_HARIAN ?? "", 10);
  return Number.isFinite(dariEnv) && dariEnv >= 1 ? dariEnv : BATAS_HARIAN_BAWAAN;
}

/** Awal hari ini dalam WIB (00:00 WIB) - batas harian ikut ganti hari saat tengah malam WIB, bukan UTC. */
export function awalHariWIB(sekarang: Date = new Date()): Date {
  return startOfDayWIB(tanggalWIB(sekarang));
}

export type RingkasanTutor = { aktif: boolean; sisaHariIni: number; batasHarian: number };

/**
 * Apakah Tanya Tutor AI aktif untuk percobaan ini, dan sisa pesan siswa hari ini. Aktif = Learning Analytics untuk
 * percobaan ini SUDAH jadi (ada hasil analisisnya): diaktifkan saat mulai ujian, dibeli susulan, atau dibundel pada
 * Try Out Nasional. Analisis yang masih diproses, gagal, atau terlewat belum membuat Tutor aktif.
 */
export async function ringkasanTutor(attempt: { id: string; studentId: string }, sekarang: Date = new Date()): Promise<RingkasanTutor> {
  const batas = batasHarianTutor();
  const [analisis, terpakai] = await Promise.all([
    prisma.aiAnalysis.findUnique({ where: { attemptId: attempt.id }, select: { attemptId: true } }),
    prisma.tutorAiPesan.count({ where: { studentId: attempt.studentId, createdAt: { gte: awalHariWIB(sekarang) } } }),
  ]);
  return { aktif: analisis !== null, sisaHariIni: Math.max(0, batas - terpakai), batasHarian: batas };
}

export type HasilReservasi = { ok: true; id: string; sisaSetelah: number } | { ok: false };

/**
 * Pesan dicatat SEBELUM AI dipanggil (reservasi), di bawah kunci per siswa: dua permintaan serentak tidak bisa sama-sama
 * lolos dari batas harian. Bila AI gagal menjawab, reservasi dilepas (lepasReservasi) supaya siswa tidak kehilangan jatah.
 */
export async function reservasiPesan(
  params: { studentId: string; attemptId: string; questionId: string },
  batas: number,
  sekarang: Date = new Date(),
): Promise<HasilReservasi> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tutor:${params.studentId}`}))`;
    const terpakai = await tx.tutorAiPesan.count({
      where: { studentId: params.studentId, createdAt: { gte: awalHariWIB(sekarang) } },
    });
    if (terpakai >= batas) return { ok: false as const };
    const baris = await tx.tutorAiPesan.create({
      data: { studentId: params.studentId, attemptId: params.attemptId, questionId: params.questionId },
      select: { id: true },
    });
    return { ok: true as const, id: baris.id, sisaSetelah: Math.max(0, batas - terpakai - 1) };
  });
}

/** Lepas reservasi (AI gagal menjawab). Aman dipanggil berulang. */
export async function lepasReservasi(id: string): Promise<void> {
  await prisma.tutorAiPesan.deleteMany({ where: { id } });
}
