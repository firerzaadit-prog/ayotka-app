import "server-only";
import type { Attempt } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { kodeSoalPaket, tentukanJenisTryOut, type IdentitasRapor } from "@/lib/exam/jenis-tryout";

/**
 * Pemuat identitas yang dicetak di kepala rapor PDF (permintaan user, 12 Okt 2026): nama siswa, asal sekolah, jenis Try Out
 * (mandiri / sekolah / nasional), kode soal, dan tanggal ujian. Bagian murninya (jenis, kode, rentang waktu) ada di
 * lib/exam/jenis-tryout.ts. Dipisah dari buildHasil (lib/exam/hasil.ts) karena hanya rapor PDF yang membutuhkannya, dan
 * buildHasil juga dipakai halaman admin dan beberapa tes.
 */
export type { IdentitasRapor, JenisTryOut } from "@/lib/exam/jenis-tryout";

/** Memuat identitas rapor untuk satu percobaan. Tiap bagian yang tidak ditemukan menjadi null, tidak menggagalkan rapor. */
export async function muatIdentitasRapor(attempt: Pick<Attempt, "id" | "studentId" | "packageId" | "assignmentId" | "mulaiAt" | "selesaiAt">): Promise<IdentitasRapor> {
  const [siswa, paket] = await Promise.all([
    prisma.student.findUnique({
      where: { id: attempt.studentId },
      select: { school: { select: { nama: true } } },
    }),
    prisma.package.findUnique({
      where: { id: attempt.packageId },
      select: {
        id: true,
        kategori: true,
        ownerType: true,
        jenjang: true,
        subject: { select: { nama: true } },
        soalImportLog: { select: { sourcePaketCode: true } },
      },
    }),
  ]);

  return {
    asalSekolah: siswa?.school?.nama?.trim() || null,
    jenisTryOut: tentukanJenisTryOut({
      kategori: paket?.kategori ?? "mandiri",
      assignmentId: attempt.assignmentId,
      ownerType: paket?.ownerType,
    }),
    mataPelajaran: paket?.subject?.nama?.trim() || null,
    jenjang: paket?.jenjang ?? null,
    kodeSoal: kodeSoalPaket(paket?.id ?? attempt.packageId, paket?.soalImportLog?.sourcePaketCode),
    mulaiAt: attempt.mulaiAt,
    selesaiAt: attempt.selesaiAt ?? null,
  };
}
