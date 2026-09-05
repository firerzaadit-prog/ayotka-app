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
    await finalizeAttempt(null, attempt.id, "kedaluwarsa");
    return prisma.attempt.findUnique({ where: { id: attemptId } });
  }

  return attempt;
}

/**
 * activeTabToken/activeTabLastSeen (session-guard.ts) dan
 * aiAnalysisProcessingAt/aiAnalysisLastError (analysis-guard.ts) ditambahkan
 * ke model Attempt supaya guard konkurensinya konsisten lintas instance
 * server - kolom ini TIDAK boleh ikut ke response client. activeTabToken
 * yang bocor ke satu device bisa dipakai device lain untuk merebut klaim
 * sesi (checkAndClaimSession menerima token apa pun yang cocok), dan
 * aiAnalysisLastError bisa berisi teks error internal yang tidak relevan
 * buat siswa. Panggil ini di SETIAP titik yang mengembalikan objek Attempt
 * mentah (bukan hasil whitelist manual seperti buildHasil() atau mapping
 * field-by-field seperti GET /api/siswa/attempts) lewat NextResponse.json.
 */
export function sanitizeAttemptForClient<T extends Attempt>(
  attempt: T,
): Omit<T, "activeTabToken" | "activeTabLastSeen" | "aiAnalysisProcessingAt" | "aiAnalysisLastError"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- sengaja di-destructure supaya dibuang dari "rest"
  const { activeTabToken, activeTabLastSeen, aiAnalysisProcessingAt, aiAnalysisLastError, ...rest } = attempt;
  return rest;
}
