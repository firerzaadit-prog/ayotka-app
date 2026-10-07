import "server-only";
import type { Attempt, TryOutKategori } from "@prisma/client";
import { wasAttemptFreeTrial } from "@/lib/billing/entitlements";
import { getAiKuotaRemaining } from "@/lib/billing/plan-fitur";
import { tentukanPendanaanLA, type PendanaanLA } from "@/lib/billing/learning-analytics";

export type PendanaanAttempt = {
  pendanaan: PendanaanLA;
  /** Sisa jatah LA per mapel; null = tidak dihitung (percobaan gratis / Try Out Nasional / tanpa paket aktif). */
  kuotaSisa: number | null;
  freeTrial: boolean;
};

/**
 * Sumber dana LA untuk satu percobaan, dengan urutan pemeriksaan yang SAMA persis dengan pemroses analisis:
 * Try Out Nasional dibundel (tanpa pemeriksaan lain), percobaan gratis tidak pernah memakai jatah paket, selain itu
 * jatah paket dipakai dulu dan saldo sesudahnya. Tidak menulis apa pun (tidak mendebit saldo).
 * Dipakai pemroses (lib/ai/queue-worker.ts), pemicu otomatis (lib/ai/auto-trigger.ts), dan tombol Learning Analytics
 * susulan (lib/billing/la-susulan.ts) - jangan menulis ulang aturan ini di tempat lain.
 */
export async function tentukanPendanaanAttempt(
  attempt: Pick<Attempt, "studentId" | "mulaiAt">,
  pkg: { subjectId: string; kategori: TryOutKategori },
): Promise<PendanaanAttempt> {
  if (pkg.kategori === "nasional") {
    return { pendanaan: tentukanPendanaanLA({ kategori: "nasional", freeTrial: false, kuotaSisa: null }), kuotaSisa: null, freeTrial: false };
  }
  // Dicek lewat wasAttemptFreeTrial (bukan entitlement SEKARANG): entitlement bisa saja sudah berakhir/berganti sejak
  // percobaan dimulai.
  const freeTrial = await wasAttemptFreeTrial(attempt.studentId, attempt.mulaiAt);
  const kuota = freeTrial ? null : await getAiKuotaRemaining(attempt.studentId, pkg.subjectId);
  const kuotaSisa = kuota?.sisa ?? null;
  return { pendanaan: tentukanPendanaanLA({ kategori: "mandiri", freeTrial, kuotaSisa }), kuotaSisa, freeTrial };
}
