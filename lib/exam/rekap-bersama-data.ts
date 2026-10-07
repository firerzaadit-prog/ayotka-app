import "server-only";
import { prisma } from "@/lib/db/prisma";
import { tutupPercobaanKedaluwarsa } from "@/lib/exam/tutup-kedaluwarsa";
import { susunRekapBersama, type HasilRekap } from "@/lib/exam/rekap-bersama";

export type RekapPenugasan = HasilRekap & {
  penugasan: {
    id: string;
    paketNama: string;
    mapel: string;
    sekolahNama: string;
    mulai: Date;
    selesai: Date;
    isActive: boolean;
  };
};

/**
 * Memuat dan menyusun rekap satu penugasan untuk sekolah tertentu; null bila penugasan tidak ada atau milik sekolah lain.
 *
 * Peserta = siswa Jalur A sekolah ini yang belum dihapus dan belum lulus (yang memakai kursi sekolah), ditambah siswa
 * yang SUDAH punya percobaan pada penugasan ini walau kemudian ditandai lulus. Siswa yang dihapus (diarsipkan) tidak
 * ikut, sama dengan analitik sekolah. Percobaan yang waktunya habis tapi belum ditutup ditutup dulu supaya nilainya benar.
 */
export async function muatRekapPenugasan(schoolId: string, assignmentId: string): Promise<RekapPenugasan | null> {
  const penugasan = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      package: { select: { nama: true, subject: { select: { nama: true } } } },
      school: { select: { nama: true } },
    },
  });
  if (!penugasan || penugasan.schoolId !== schoolId) return null;

  await tutupPercobaanKedaluwarsa({ assignmentId }).catch((err) => {
    console.error("[tutup-kedaluwarsa] gagal untuk penugasan", assignmentId, err);
  });

  const [siswa, attempts] = await Promise.all([
    prisma.student.findMany({
      where: {
        schoolId,
        jalur: "A",
        deletedAt: null,
        OR: [{ lulusAt: null }, { attempts: { some: { assignmentId } } }],
      },
      select: { id: true, nama: true, nisn: true, claimStatus: true },
    }),
    prisma.attempt.findMany({
      where: { assignmentId, student: { schoolId, jalur: "A", deletedAt: null } },
      select: { id: true, studentId: true, status: true, skorAkhir: true, mulaiAt: true, selesaiAt: true, tabSwitchCount: true },
    }),
  ]);

  const hasil = susunRekapBersama(
    siswa.map((s) => ({ studentId: s.id, nama: s.nama, nisn: s.nisn, claimStatus: s.claimStatus })),
    attempts,
  );

  return {
    ...hasil,
    penugasan: {
      id: penugasan.id,
      paketNama: penugasan.package.nama,
      mapel: penugasan.package.subject.nama,
      sekolahNama: penugasan.school?.nama ?? "-",
      mulai: penugasan.mulai,
      selesai: penugasan.selesai,
      isActive: penugasan.isActive,
    },
  };
}
