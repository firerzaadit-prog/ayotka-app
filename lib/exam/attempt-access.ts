import "server-only";
import { prisma } from "@/lib/db/prisma";
import { isExpired } from "@/lib/exam/timing";
import { finalizeAttempt } from "@/lib/exam/finalize";
import type { Attempt } from "@prisma/client";

/**
 * Cegah IDOR (Bagian 9 brief: "semua endpoint dicek kepemilikan") - attempt
 * cuma bisa diakses oleh siswa pemiliknya sendiri. Sekaligus jadi titik
 * pengecekan lazy-expiry: attempt "berjalan" yang waktunya sudah habis
 * otomatis di-auto-submit di sini, jadi setiap request yang menyentuh
 * attempt ini (baca, simpan jawaban, dst.) memastikan statusnya akurat
 * tanpa perlu cron/queue terpisah.
 */
export async function loadOwnedAttempt(userId: string, attemptId: string): Promise<Attempt | null> {
  const student = await prisma.student.findFirst({ where: { userId } });
  if (!student) return null;

  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.studentId !== student.id) return null;

  if (attempt.status === "berjalan" && isExpired(attempt)) {
    await prisma.$transaction((tx) => finalizeAttempt(tx, attempt.id, "kedaluwarsa"));
    return prisma.attempt.findUnique({ where: { id: attemptId } });
  }

  return attempt;
}
