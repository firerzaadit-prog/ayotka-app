import "server-only";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import type { Entitlement, EntitlementSource, Student } from "@prisma/client";
import {
  akhirEfektif,
  ambilPeriodeSekolah,
  hitungKursiPeriode,
  pilihPeriodeAkanDatang,
  pilihPeriodeBerjalan,
  pilihPeriodeTerakhirBerakhir,
} from "@/lib/billing/periode-sekolah";

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

/** Plan `school` dipakai sebagai plan_id generik untuk entitlement source=school_seat (setara Paket Semester: 3x TO Nasional + 1x AI per mapel). */
export async function ensureSchoolPlan() {
  const existing = await prisma.plan.findFirst({ where: { kode: "school" } });
  if (existing) {
    const currentFitur = (existing.fitur as Record<string, unknown> | null) ?? {};
    if (typeof currentFitur.tryOutNasionalKuotaPerMapel !== "number" || currentFitur.tryOutNasionalKuotaPerMapel <= 0) {
      return prisma.plan.update({
        where: { id: existing.id },
        data: {
          fitur: {
            ...currentFitur,
            aiKuotaPerMapel: typeof currentFitur.aiKuotaPerMapel === "number" ? currentFitur.aiKuotaPerMapel : 1,
            tryOutNasionalKuotaPerMapel: 3,
          },
        },
      });
    }
    return existing;
  }
  return prisma.plan.create({
    data: {
      kode: "school",
      nama: "Sekolah & Lembaga",
      harga: 0,
      durasiHari: null,
      isActive: true,
      fitur: {
        aiKuotaPerMapel: 1,
        tryOutNasionalKuotaPerMapel: 3,
      },
    },
  });
}

/**
 * Kursi sekolah (Bagian 5): entitlement per siswa dibuat LAZY saat dibutuhkan (dipanggil dari
 * canStartAttempt), bukan retroaktif massal begitu admin pusat mengaktifkan periode - supaya siswa yang sudah
 * terdaftar otomatis kebagian tanpa skrip migrasi terpisah.
 *
 * Kursi dihitung PER PERIODE LANGGANAN (lib/billing/periode-sekolah.ts) dan unik per siswa per periode.
 * Dulu kursi dihitung dari semua entitlement sekolah tanpa melihat tanggal dan berakhir di snapshot
 * School.validUntil, sehingga setelah perpanjangan kursi lama yang sudah kedaluwarsa tetap dihitung terpakai
 * dan siswa lama kena "kuota penuh". Sekarang perpanjangan = periode baru dan siswa lama mendapat kursi baru
 * (jatah AI/Try Out Nasional per jendela entitlement mulai dari nol).
 *
 * Bagian 6.6: kalau kuota penuh, siswa TIDAK dibuatkan entitlement - pemanggil (canStartAttempt) tetap
 * membiarkan progres attempt-nya tersimpan sebagai "menunggu kuota", bukan mendaftarkan lalu memblokir.
 *
 * Catatan balapan: dua siswa berbeda yang mulai bersamaan saat sisa kuota tinggal satu bisa sama-sama lolos
 * hitungan. Dibiarkan tanpa kunci baris (kunci akan membuat ratusan siswa yang mulai ujian serentak mengantre
 * satu per satu): jumlah siswa terdaftar sudah dibatasi kuota saat ditambahkan (assertKuotaTersedia), sehingga
 * kursi tidak melebihi kuota kecuali kuota periode baru sengaja diset di bawah jumlah siswa.
 */
export type SeatGrantResult =
  | { granted: true; entitlement: Entitlement }
  /** Sekolah belum pernah punya periode langganan. */
  | { granted: false; reason: "not_activated" }
  /** Bukan siswa Jalur A di sekolah ini (mis. siswa mandiri yang hanya mencatat sekolah asal) atau sudah dihapus. */
  | { granted: false; reason: "not_eligible" }
  /** Sudah ditandai lulus (alumni): kursi sekolah tidak berlaku lagi; riwayat dan nilai tetap bisa dibuka. */
  | { granted: false; reason: "alumni" }
  /** Semua periode sudah lewat (termasuk masa tenggang): sekolah "dibekukan" sampai diperpanjang. */
  | { granted: false; reason: "period_ended"; berakhir: Date }
  /** Periode pertama/berikutnya belum mulai. */
  | { granted: false; reason: "period_not_started"; mulai: Date }
  /** Bagian 9 kasus tepi #6: kuota periode aktif tapi penuh - siswa "menunggu kuota", bukan ditolak permanen.
   * Begitu kuota ditambah atau kursi dibebaskan, panggilan canStartAttempt berikutnya otomatis berhasil. */
  | { granted: false; reason: "seat_full" };

export async function grantSchoolSeatIfAvailable(
  studentId: string,
  schoolId: string,
  now: Date = new Date(),
): Promise<SeatGrantResult> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { schoolId: true, jalur: true, deletedAt: true, lulusAt: true },
  });
  // Kursi sekolah hanya untuk siswa Jalur A milik sekolah itu. Siswa mandiri (Jalur B) bisa mencatat sekolah
  // asal tetapi membeli langganannya sendiri; tanpa pagar ini mereka bisa menguras kursi sekolah.
  if (!student || student.jalur !== "A" || student.deletedAt || student.schoolId !== schoolId) {
    return { granted: false, reason: "not_eligible" };
  }
  if (student.lulusAt) return { granted: false, reason: "alumni" };

  const periodeSekolah = await ambilPeriodeSekolah(prisma, schoolId);
  const berjalan = pilihPeriodeBerjalan(periodeSekolah, now);
  if (!berjalan) {
    const selesai = pilihPeriodeTerakhirBerakhir(periodeSekolah, now);
    if (selesai) return { granted: false, reason: "period_ended", berakhir: selesai.berakhir };
    const nanti = pilihPeriodeAkanDatang(periodeSekolah, now);
    if (nanti) return { granted: false, reason: "period_not_started", mulai: nanti.mulai };
    return { granted: false, reason: "not_activated" };
  }

  const batas = akhirEfektif(berjalan);
  // Kursi siswa ini pada periode ini (termasuk yang pernah dicabut): unik per siswa per periode.
  const ada = await prisma.entitlement.findUnique({
    where: { studentId_periodeId: { studentId, periodeId: berjalan.id } },
  });
  if (ada && !ada.revokedAt) {
    // Kursi dari data lama/periode yang diperpanjang bisa berakhir lebih awal dari batas periode: samakan.
    if (ada.endsAt.getTime() >= batas.getTime()) return { granted: true, entitlement: ada };
    const diperbarui = await prisma.entitlement.update({ where: { id: ada.id }, data: { endsAt: batas } });
    return { granted: true, entitlement: diperbarui };
  }

  if ((await hitungKursiPeriode(prisma, berjalan.id)) >= berjalan.seatQuota) {
    return { granted: false, reason: "seat_full" };
  }

  // Kursi yang pernah dicabut (mis. siswa sempat ditandai lulus lalu dibatalkan) dihidupkan lagi, bukan dibuat baru.
  if (ada) {
    const dihidupkan = await prisma.entitlement.update({
      where: { id: ada.id },
      data: { revokedAt: null, startsAt: now, endsAt: batas },
    });
    return { granted: true, entitlement: dihidupkan };
  }

  const plan = await ensureSchoolPlan();
  try {
    const entitlement = await prisma.entitlement.create({
      data: {
        studentId,
        planId: plan.id,
        source: "school_seat" as EntitlementSource,
        schoolId,
        periodeId: berjalan.id,
        startsAt: now,
        endsAt: batas,
      },
    });
    return { granted: true, entitlement };
  } catch (error) {
    // Dua permintaan serentak untuk siswa yang sama: yang kedua kalah balapan pada batas unik - pakai kursi yang sudah jadi.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const sudahAda = await prisma.entitlement.findUnique({
        where: { studentId_periodeId: { studentId, periodeId: berjalan.id } },
      });
      if (sudahAda && !sudahAda.revokedAt) return { granted: true, entitlement: sudahAda };
    }
    throw error;
  }
}

/**
 * Apakah siswa BISA mendapat kursi sekolah sekarang, tanpa membuatnya (read-only; pasangan
 * grantSchoolSeatIfAvailable). Dipakai getTipeAkses untuk menampilkan tipe akses sebelum siswa menekan Mulai.
 */
export async function kursiSekolahTersedia(
  student: Pick<Student, "id" | "schoolId" | "jalur" | "deletedAt" | "lulusAt">,
  now: Date = new Date(),
): Promise<boolean> {
  if (!student.schoolId || student.jalur !== "A" || student.deletedAt || student.lulusAt) return false;
  const berjalan = pilihPeriodeBerjalan(await ambilPeriodeSekolah(prisma, student.schoolId), now);
  if (!berjalan) return false;
  const ada = await prisma.entitlement.findUnique({
    where: { studentId_periodeId: { studentId: student.id, periodeId: berjalan.id } },
    select: { revokedAt: true },
  });
  if (ada && !ada.revokedAt) return true;
  return (await hitungKursiPeriode(prisma, berjalan.id)) < berjalan.seatQuota;
}

/**
 * Plan `free` (Bagian 3): 1x try out per mata pelajaran untuk siswa tanpa
 * entitlement aktif, tanpa riwayat tersimpan sebagai fitur berbayar.
 * Dihitung dari jumlah attempt yang PERNAH dibuat untuk mapel ini (bukan
 * cuma yang selesai) supaya jatah tidak bisa "direset" dengan meninggalkan
 * attempt menggantung.
 */
/**
 * Rincian Biaya AyoTKA - "Free trial TIDAK mendapat Analisis AI": dipakai
 * SETELAH attempt dibuat (auto-trigger AI, halaman hasil) untuk menentukan
 * apakah attempt tsb lahir dari akses berbayar/sekolah atau dari jatah
 * gratis. Tidak ada kolom tersendiri di Attempt yang mencatat ini - dicek
 * ulang dari ada/tidaknya entitlement yang mencakup waktu mulai attempt,
 * karena free_trial memang sengaja tidak pernah membuat baris entitlements
 * (lihat canStartAttempt).
 */
export async function wasAttemptFreeTrial(studentId: string, attemptMulaiAt: Date): Promise<boolean> {
  const covering = await prisma.entitlement.findFirst({
    where: {
      studentId,
      revokedAt: null,
      startsAt: { lte: attemptMulaiAt },
      endsAt: { gte: attemptMulaiAt },
    },
    select: { id: true },
  });
  return !covering;
}

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
  /** Bagian 9 kasus tepi #6: kuota sekolah sedang penuh - beda dari
   * quota_required biasa karena ini otomatis pulih sendiri begitu admin
   * menambah seatQuota, tanpa siswa perlu melakukan apa pun. */
  | { allowed: false; reason: "waiting_for_seat" }
  /** Langganan sekolah sudah berakhir (termasuk tenggang): sekolah "dibekukan" sampai diperpanjang. */
  | { allowed: false; reason: "sekolah_berakhir"; berakhir: Date }
  /** Langganan sekolah belum mulai berlaku. */
  | { allowed: false; reason: "sekolah_belum_mulai"; mulai: Date }
  /** Siswa sudah ditandai lulus: kursi sekolah tidak berlaku lagi. */
  | { allowed: false; reason: "alumni" }
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

  let seatResult: SeatGrantResult | null = null;
  if (schoolId) {
    seatResult = await grantSchoolSeatIfAvailable(studentId, schoolId);
    if (seatResult.granted) return { allowed: true, reason: "school_seat" };
  }

  const usedFree = await hasUsedFreeTrial(studentId, subjectId);
  if (!usedFree) return { allowed: true, reason: "free_trial" };

  if (seatResult && !seatResult.granted) {
    if (seatResult.reason === "seat_full") return { allowed: false, reason: "waiting_for_seat" };
    if (seatResult.reason === "alumni") return { allowed: false, reason: "alumni" };
    if (seatResult.reason === "period_ended") {
      return { allowed: false, reason: "sekolah_berakhir", berakhir: seatResult.berakhir };
    }
    if (seatResult.reason === "period_not_started") {
      return { allowed: false, reason: "sekolah_belum_mulai", mulai: seatResult.mulai };
    }
  }
  return { allowed: false, reason: "quota_required" };
}
