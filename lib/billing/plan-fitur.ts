import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getActiveEntitlement } from "@/lib/billing/entitlements";

/**
 * Bagian C/G (permintaan user, "admin pusat bisa atur skema pembayaran di
 * website tanpa merubah kode"): konfigurasi fitur per Plan disimpan di
 * kolom Plan.fitur (JSON, sudah ada di skema tapi belum pernah dipakai).
 * Field yang tidak diisi otomatis dapat nilai default di bawah - jadi admin
 * cukup isi field yang mau diubah saja lewat halaman Paket & Rekening.
 */
const planFiturSchema = z.object({
  /** Jatah Learning Analytics (analisis AI) GRATIS per mata pelajaran, per masa aktif langganan. */
  aiKuotaPerMapel: z.number().int().min(0).default(1),
  /** Jatah Try Out Nasional per mata pelajaran, per masa aktif langganan. 0 = tidak dapat akses Try Out Nasional. */
  tryOutNasionalKuotaPerMapel: z.number().int().min(0).default(0),
});
export type PlanFitur = z.infer<typeof planFiturSchema>;

export function parsePlanFitur(fitur: unknown): PlanFitur {
  const result = planFiturSchema.safeParse(fitur ?? {});
  return result.success ? result.data : planFiturSchema.parse({});
}

export type KuotaStatus = { sisa: number; total: number };

/**
 * Jatah Learning Analytics GRATIS yang tersisa untuk mapel ini, dalam masa
 * aktif entitlement SEKARANG (bukan seumur hidup - reset tiap kali
 * berlangganan ulang, sama seperti pola wasAttemptFreeTrial). null berarti
 * siswa tidak punya entitlement aktif (mis. free trial) - Learning
 * Analytics sama sekali tidak ditawarkan untuk kasus itu, apa pun saldonya.
 */
export async function getAiKuotaRemaining(studentId: string, subjectId: string): Promise<KuotaStatus | null> {
  const active = await getActiveEntitlement(studentId);
  if (!active) return null;

  const plan = await prisma.plan.findUnique({ where: { id: active.entitlement.planId } });
  if (!plan) return null;
  const fitur = parsePlanFitur(plan.fitur);

  const used = await prisma.aiAnalysis.count({
    where: {
      sumber: "kuota",
      attempt: {
        studentId,
        package: { subjectId },
        mulaiAt: { gte: active.entitlement.startsAt, lte: active.entitlement.endsAt },
      },
    },
  });

  return { sisa: Math.max(0, fitur.aiKuotaPerMapel - used), total: fitur.aiKuotaPerMapel };
}

export type NasionalKuotaStatus = KuotaStatus & { usedEventIds: Set<string> };

/**
 * Jatah Try Out Nasional yang tersisa untuk mapel ini - dihitung dari
 * banyaknya PAKET nasional berbeda yang sudah diikuti (satu paket = satu
 * event), bukan banyaknya attempt (retry pada paket yang sama tidak
 * menambah pemakaian jatah - lihat usedEventIds, dicek di
 * app/api/siswa/attempts/route.ts sebelum menolak attempt baru).
 */
export async function getTryOutNasionalKuotaRemaining(studentId: string, subjectId: string): Promise<NasionalKuotaStatus> {
  const active = await getActiveEntitlement(studentId);
  if (!active) return { sisa: 0, total: 0, usedEventIds: new Set() };

  const plan = await prisma.plan.findUnique({ where: { id: active.entitlement.planId } });
  if (!plan) return { sisa: 0, total: 0, usedEventIds: new Set() };
  const fitur = parsePlanFitur(plan.fitur);

  // Siswa sekolah (source = school_seat atau plan kode = school) mendapatkan fasilitas setara Paket Semester
  const isSchool = active.entitlement.source === "school_seat" || plan.kode === "school";
  const totalKuota = isSchool
    ? (fitur.tryOutNasionalKuotaPerMapel > 0 ? fitur.tryOutNasionalKuotaPerMapel : 3)
    : fitur.tryOutNasionalKuotaPerMapel;

  const attempts = await prisma.attempt.findMany({
    where: {
      studentId,
      mulaiAt: { gte: active.entitlement.startsAt, lte: active.entitlement.endsAt },
      package: { subjectId, kategori: "nasional" },
    },
    select: { package: { select: { id: true } } },
  });
  const usedEventIds = new Set(attempts.map((a) => a.package.id));

  return {
    sisa: Math.max(0, totalKuota - usedEventIds.size),
    total: totalKuota,
    usedEventIds,
  };
}
