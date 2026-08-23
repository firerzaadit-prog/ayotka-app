import "server-only";
import { prisma } from "@/lib/db/prisma";
import { generateReadableCode } from "@/lib/utils/generate-code";
import type { Jenjang } from "@prisma/client";

export class KuotaPenuhError extends Error {
  constructor() {
    super("Kuota siswa sekolah sudah penuh. Hubungi Admin Pusat untuk menambah kuota.");
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

/**
 * Tiket 3.7 (Bagian 7.2 brief): kuota dihitung dari siswa Jalur A saja -
 * siswa mandiri (Jalur B) berlangganan sendiri per Fase 6, bukan bagian
 * dari kuota berlangganan sekolah.
 */
export async function assertKuotaTersedia(schoolId: string, tambahan: number): Promise<void> {
  const [school, jumlahSiswaAktif] = await Promise.all([
    prisma.school.findUniqueOrThrow({ where: { id: schoolId } }),
    prisma.student.count({ where: { schoolId, jalur: "A", deletedAt: null } }),
  ]);
  if (jumlahSiswaAktif + tambahan > school.kuotaSiswa) {
    throw new KuotaPenuhError();
  }
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
  const claimToken = await generateUniqueClaimToken();
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
      claimStatus: "belum_klaim",
      status: "pending",
      enrollments: {
        create: { classId: params.classId, academicYearId: params.academicYearId },
      },
    },
  });
}
