import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { finalizeAttempt } from "@/lib/exam/finalize";

/**
 * Menutup percobaan ujian yang waktunya sudah habis tetapi masih berstatus "berjalan".
 *
 * Penutupan otomatis sebelumnya bersifat malas (lazy): hanya terjadi saat SISWA YANG SAMA membuka ujiannya lagi
 * (lib/exam/attempt-access.ts), memulai ujian baru, atau admin sekolah menekan Jeda. Siswa yang menutup peramban atau
 * kehabisan baterai lalu tidak membuka ujiannya lagi tidak pernah ditutup: statusnya tetap "Sedang mengerjakan"
 * selamanya, skornya tidak masuk rekap sekolah, ranking, atau Analisis AI.
 *
 * Fungsi ini dipanggil dari dua tempat: cron harian (menyapu semua) dan daftar percobaan di halaman pantau admin
 * (menyapu satu penugasan, supaya yang dilihat admin langsung benar tanpa menunggu cron).
 *
 * Aman dipanggil berulang dan serentak: finalizeAttempt idempoten (status diubah paling akhir), dan setiap percobaan
 * dibaca ulang tepat sebelum ditutup supaya yang baru saja dikumpulkan siswa tidak ditimpa menjadi kedaluwarsa.
 */

/** Batas bawaan percobaan yang ditutup per pemanggilan, agar satu permintaan tidak berjalan terlalu lama. */
export const BATAS_TUTUP_BAWAAN = 100;

type DbTutup = Pick<PrismaClient, "attempt">;

export type DependensiTutup = {
  db: DbTutup;
  /** Menutup satu percobaan sebagai kedaluwarsa (menghitung skor dan memicu analisis sesuai aturan). */
  tutup: (attemptId: string) => Promise<void>;
  /** Untuk pengujian. */
  sekarang?: () => Date;
};

export type OpsiTutup = {
  /** Batasi ke satu penugasan (halaman pantau). Kosong: semua percobaan. */
  assignmentId?: string;
  /** Jumlah maksimum yang ditutup dalam satu pemanggilan. */
  batas?: number;
};

export type HasilTutup = {
  /** Percobaan berstatus berjalan yang dibaca sebagai kandidat. */
  diperiksa: number;
  ditutup: string[];
  gagal: { attemptId: string; galat: string }[];
};

function galatPesan(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function tutupPercobaanKedaluwarsaDengan(
  dep: DependensiTutup,
  opsi: OpsiTutup = {},
): Promise<HasilTutup> {
  const sekarang = (dep.sekarang ?? (() => new Date()))();
  const batas = opsi.batas ?? BATAS_TUTUP_BAWAAN;

  // Yang berjalan paling lama dibaca lebih dulu: merekalah yang paling mungkin sudah habis waktunya. Batas waktu
  // (mulaiAt + sisaDetik) tidak bisa disaring di basis data lewat Prisma, jadi disaring di sini.
  const kandidat = await dep.db.attempt.findMany({
    where: {
      status: "berjalan",
      mulaiAt: { lt: sekarang },
      ...(opsi.assignmentId ? { assignmentId: opsi.assignmentId } : {}),
    },
    select: { id: true, mulaiAt: true, sisaDetik: true },
    orderBy: { mulaiAt: "asc" },
    take: Math.max(batas * 5, 500),
  });

  const habis = kandidat
    .filter((a) => a.mulaiAt.getTime() + a.sisaDetik * 1000 <= sekarang.getTime())
    .slice(0, batas);

  const hasil: HasilTutup = { diperiksa: kandidat.length, ditutup: [], gagal: [] };
  for (const a of habis) {
    try {
      // Baca ulang: siswa mungkin baru saja mengumpulkan, atau admin baru saja menjeda/melanjutkan (mulaiAt berubah).
      const terbaru = await dep.db.attempt.findUnique({
        where: { id: a.id },
        select: { status: true, mulaiAt: true, sisaDetik: true },
      });
      if (!terbaru || terbaru.status !== "berjalan") continue;
      if (terbaru.mulaiAt.getTime() + terbaru.sisaDetik * 1000 > sekarang.getTime()) continue;
      await dep.tutup(a.id);
      hasil.ditutup.push(a.id);
    } catch (error) {
      hasil.gagal.push({ attemptId: a.id, galat: galatPesan(error) });
    }
  }
  return hasil;
}

/** Versi untuk aplikasi: memakai basis data dan finalizeAttempt yang sebenarnya. */
export function tutupPercobaanKedaluwarsa(opsi: OpsiTutup = {}): Promise<HasilTutup> {
  return tutupPercobaanKedaluwarsaDengan(
    { db: prisma, tutup: (id) => finalizeAttempt(null, id, "kedaluwarsa") },
    opsi,
  );
}
