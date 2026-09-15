import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Entitlement, EntitlementSource } from "@prisma/client";

const GRACE_DAYS = 7;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export type EntitlementStatus = {
  entitlement: Entitlement;
  /** Boleh mulai attempt baru - now <= ends_at. */
  canStartNewAttempt: boolean;
  /** Boleh lihat riwayat lama - now <= ends_at + grace_days (Bagian 6.3). */
  canViewHistory: boolean;
};

/**
 * Satu-satunya sumber kebenaran untuk "apakah siswa ini boleh akses tryout
 * sekarang?" - dipakai di SELURUH sistem lewat fungsi ini, apa pun jalur
 * pembayarannya (invoice/voucher/school_seat). Tidak ada logika cek akses
 * lain yang ditulis ulang di tempat lain (DoD dokumen rencana Bagian 12).
 *
 * Entitlement tumpang tindih (mis. sekolah + beli mandiri sekaligus)
 * diselesaikan dengan ambil ends_at paling jauh (Bagian 6.1):
 *   MAX(ends_at) WHERE student_id=? AND revoked_at IS NULL AND starts_at<=now
 */
export async function getActiveEntitlement(studentId: string): Promise<EntitlementStatus | null> {
  const now = new Date();
  const best = await prisma.entitlement.findFirst({
    where: { studentId, revokedAt: null, startsAt: { lte: now } },
    orderBy: { endsAt: "desc" },
  });
  if (!best) return null;

  const graceUntil = best.graceUntil ?? addDays(best.endsAt, GRACE_DAYS);
  return {
    entitlement: best,
    canStartNewAttempt: now <= best.endsAt,
    canViewHistory: now <= graceUntil,
  };
}

async function ensurePlanByKode(kode: "free" | "monthly" | "semester" | "school", nama: string, harga: number, durasiHari: number | null) {
  const existing = await prisma.plan.findFirst({ where: { kode } });
  if (existing) return existing;
  return prisma.plan.create({ data: { kode, nama, harga, durasiHari, isActive: true } });
}

/** Plan `school` dipakai sebagai plan_id generik untuk entitlement source=school_seat. */
export async function ensureSchoolPlan() {
  return ensurePlanByKode("school", "Sekolah", 0, null);
}

/**
 * Jalur B (sekolah, Bagian 5): entitlement per siswa dibuat LAZY saat
 * dibutuhkan (dipanggil dari canStartAttempt), bukan retroaktif massal
 * begitu admin pusat mengaktifkan seat_quota - supaya siswa yang sudah
 * terdaftar sebelum kuota aktif otomatis kebagian tanpa skrip migrasi
 * terpisah. seatsUsed dihitung LIVE dari jumlah entitlements
 * source=school_seat milik sekolah tsb (bukan counter terpisah yang
 * rawan race condition antar-request paralel).
 *
 * Bagian 6.6: kalau kuota penuh, siswa TIDAK dibuatkan entitlement -
 * pemanggil (canStartAttempt) tetap membiarkan progres attempt-nya
 * tersimpan sebagai "menunggu kuota", bukan mendaftarkan lalu memblokir.
 */
export async function grantSchoolSeatIfAvailable(
  studentId: string,
  schoolId: string,
): Promise<Entitlement | null> {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school || school.seatQuota == null || !school.validUntil || school.validUntil < new Date()) {
    return null;
  }

  const seatsUsed = await prisma.entitlement.count({
    where: { schoolId, source: "school_seat", revokedAt: null },
  });
  if (seatsUsed >= school.seatQuota) return null;

  const plan = await ensureSchoolPlan();
  return prisma.entitlement.create({
    data: {
      studentId,
      planId: plan.id,
      source: "school_seat" as EntitlementSource,
      schoolId,
      startsAt: new Date(),
      endsAt: school.validUntil,
    },
  });
}

/**
 * Plan `free` (Bagian 3): 1x try out per mata pelajaran untuk siswa tanpa
 * entitlement aktif, tanpa riwayat tersimpan sebagai fitur berbayar.
 * Dihitung dari jumlah attempt yang PERNAH dibuat untuk mapel ini (bukan
 * cuma yang selesai) supaya jatah tidak bisa "direset" dengan meninggalkan
 * attempt menggantung.
 */
export async function hasUsedFreeTrial(studentId: string, subjectId: string): Promise<boolean> {
  const count = await prisma.attempt.count({
    where: {
      studentId,
      OR: [{ package: { subjectId } }, { assignment: { package: { subjectId } } }],
    },
  });
  return count > 0;
}

export type AccessCheckResult =
  | { allowed: true; reason: "entitlement" | "school_seat" | "free_trial" }
  | { allowed: false; reason: "quota_required" };

/**
 * Gerbang akses TUNGGAL dipanggil sebelum membuat attempt baru - dipakai
 * SAMA PERSIS untuk siswa jalur sekolah maupun mandiri (menggantikan 2
 * cabang terpisah yang sebelumnya ada di app/api/siswa/attempts/route.ts).
 */
export async function canStartAttempt(
  studentId: string,
  subjectId: string,
  schoolId: string | null,
): Promise<AccessCheckResult> {
  const active = await getActiveEntitlement(studentId);
  if (active?.canStartNewAttempt) return { allowed: true, reason: "entitlement" };

  if (schoolId) {
    const granted = await grantSchoolSeatIfAvailable(studentId, schoolId);
    if (granted) return { allowed: true, reason: "school_seat" };
  }

  const usedFree = await hasUsedFreeTrial(studentId, subjectId);
  if (!usedFree) return { allowed: true, reason: "free_trial" };

  return { allowed: false, reason: "quota_required" };
}
