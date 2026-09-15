import "server-only";
import { prisma } from "@/lib/db/prisma";
import { generateReadableCode } from "@/lib/utils/generate-code";
import type { Jenjang } from "@prisma/client";

/**
 * Sejak redesign billing (Bagian 7.3, lalu entitlements Bagian 5), tidak
 * ada lagi batas jumlah siswa per sekolah di model School. Akses try out
 * siswa Jalur B (sekolah) diatur lewat seatQuota/validUntil + entitlements
 * (lib/billing/entitlements.ts), bukan jumlah akun siswa yang terdaftar.
 * KuotaPenuhError dipertahankan untuk kompatibilitas ke depan, tapi
 * assertKuotaTersedia tidak lagi memblokir penambahan siswa.
 */
export class KuotaPenuhError extends Error {
  constructor() {
    super("Kuota siswa sekolah sudah penuh. Hubungi Admin Pusat.");
  }
}

async function generateUniqueClaimToken(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const token = generateReadableCode(8);
    const existing = await prisma.student.findUnique({ where: { claimToken: token } });
    if (!existing) return token;
  }
  throw new Error("Gagal membuat kode klaim unik, coba lagi.");
}

/** Kode referral siswa (dibagikan ke calon siswa baru) - wajib diisi setiap Student baru dibuat. */
export async function generateUniqueStudentReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReadableCode(6);
    const existing = await prisma.student.findUnique({ where: { referralCode: code } });
    if (!existing) return code;
  }
  throw new Error("Gagal membuat kode referral unik, coba lagi.");
}

/**
 * Tiket 3.7: tidak ada lagi batas kuota dari model School.
 * Fungsi ini dipertahankan agar caller tidak perlu diubah,
 * tapi tidak lagi memblokir — admin pusat mengatur akses
 * try out lewat seatQuota/validUntil (lib/billing/entitlements.ts).
 */
export async function assertKuotaTersedia(_schoolId: string, _tambahan: number): Promise<void> {
  // Tidak ada batasan kuota di School model lagi (post billing redesign)
  return;
}

export async function createStudentWithEnrollment(params: {
  schoolId: string;
  jenjang: Jenjang;
  nama: string;
  nisn?: string;
  tanggalLahir?: Date;
  classId: string;
  tingkat: number;
  academicYearId: string;
}) {
  const [claimToken, referralCode] = await Promise.all([
    generateUniqueClaimToken(),
    generateUniqueStudentReferralCode(),
  ]);
  return prisma.student.create({
    data: {
      schoolId: params.schoolId,
      jenjang: params.jenjang,
      tingkat: params.tingkat,
      nama: params.nama,
      nisn: params.nisn && params.nisn.length > 0 ? params.nisn : null,
      tanggalLahir: params.tanggalLahir ?? null,
      jalur: "A",
      claimToken,
      referralCode,
      claimStatus: "belum_klaim",
      status: "pending",
      enrollments: {
        create: { classId: params.classId, academicYearId: params.academicYearId },
      },
    },
  });
}
