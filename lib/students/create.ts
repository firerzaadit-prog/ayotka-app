import "server-only";
import { prisma } from "@/lib/db/prisma";
import { generateReadableCode } from "@/lib/utils/generate-code";
import { formatWIBDate } from "@/lib/utils/datetime";
import {
  ambilPeriodeSekolah,
  pilihPeriodeAkanDatang,
  pilihPeriodeBerjalan,
  pilihPeriodeTerakhirBerakhir,
} from "@/lib/billing/periode-sekolah";
import type { Jenjang } from "@prisma/client";

/**
 * Sejak redesign billing (Bagian 7.3, lalu entitlements Bagian 5), tidak
 * ada lagi batas jumlah siswa per sekolah di model School. Akses try out
 * siswa Jalur B (sekolah) diatur lewat periode langganan + entitlements
 * (lib/billing/entitlements.ts), bukan jumlah akun siswa yang terdaftar.
 * KuotaPenuhError dipertahankan untuk kompatibilitas ke depan, tapi
 * assertKuotaTersedia tidak lagi memblokir penambahan siswa.
 */
export class KuotaPenuhError extends Error {
  constructor(message = "Kuota siswa sekolah sudah penuh. Hubungi Admin Pusat.") {
    super(message);
    this.name = "KuotaPenuhError";
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
    // Kolom kode referral di pendaftaran menerima kode siswa maupun mitra, jadi kode tidak boleh kembar antar keduanya.
    const [siswa, mitra] = await Promise.all([
      prisma.student.findUnique({ where: { referralCode: code } }),
      prisma.partner.findUnique({ where: { referralCode: code } }),
    ]);
    if (!siswa && !mitra) return code;
  }
  throw new Error("Gagal membuat kode referral unik, coba lagi.");
}

/**
 * Kursi terpakai = siswa Jalur A terdaftar yang belum dihapus. Satu definisi ini
 * dipakai pembatas tambah/impor siswa DAN tampilan kuota (admin sekolah & admin
 * pusat) - dulu tampilan menghitung siswa yang sudah pernah mulai ujian, jadi bisa
 * tertulis "1/5 kursi terpakai" padahal tambah siswa ditolak "kuota penuh".
 */
export function hitungKursiTerpakai(schoolId: string): Promise<number> {
  return prisma.student.count({ where: { schoolId, jalur: "A", deletedAt: null } });
}

/**
 * Kuota acuan untuk batas tambah/impor siswa: kuota periode yang sedang berjalan (aktif atau tenggang), kalau
 * tidak ada maka periode terdekat berikutnya. null = sekolah belum punya periode yang berlaku atau akan datang.
 * Kolom lama School.seatQuota TIDAK dipakai karena tidak berubah sendiri saat waktu berjalan.
 */
export async function kuotaAcuanSekolah(schoolId: string, now: Date = new Date()): Promise<number | null> {
  const periode = await ambilPeriodeSekolah(prisma, schoolId);
  const acuan = pilihPeriodeBerjalan(periode, now) ?? pilihPeriodeAkanDatang(periode, now);
  return acuan?.seatQuota ?? null;
}

/**
 * Pengecekan kuota kursi siswa yang telah disepakati & diaktifkan Admin Pusat (per periode langganan).
 * Dipanggil saat Admin Sekolah menambah siswa secara manual maupun import Excel. Setelah langganan berakhir
 * (termasuk masa tenggang) sekolah "dibekukan": tidak bisa menambah/mengimpor siswa sampai diperpanjang.
 */
export async function assertKuotaTersedia(schoolId: string, tambahan: number, now: Date = new Date()): Promise<void> {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
  if (!school) return;

  const periode = await ambilPeriodeSekolah(prisma, schoolId);
  if (periode.length === 0) {
    throw new KuotaPenuhError(
      "Sekolah ini belum memiliki periode langganan yang diaktifkan oleh Admin Pusat. Hubungi Admin Pusat untuk mengaktifkan kursi terlebih dahulu."
    );
  }

  const acuan = pilihPeriodeBerjalan(periode, now) ?? pilihPeriodeAkanDatang(periode, now);
  if (!acuan) {
    const selesai = pilihPeriodeTerakhirBerakhir(periode, now);
    throw new KuotaPenuhError(
      selesai
        ? `Langganan sekolah berakhir pada ${formatWIBDate(selesai.berakhir)}. Hubungi Admin Pusat untuk memperpanjang sebelum menambah atau mengimpor siswa.`
        : "Sekolah ini tidak memiliki periode langganan yang berlaku. Hubungi Admin Pusat."
    );
  }

  const currentCount = await hitungKursiTerpakai(schoolId);

  if (currentCount + tambahan > acuan.seatQuota) {
    const sisa = Math.max(0, acuan.seatQuota - currentCount);
    throw new KuotaPenuhError(
      `Kuota siswa sekolah tidak mencukupi. Kuota dari Admin Pusat: ${acuan.seatQuota} siswa, saat ini terdaftar: ${currentCount} siswa, sisa kuota: ${sisa} siswa. Menambahkan ${tambahan} siswa akan melebihi kuota kursi yang disepakati.`
    );
  }
}

export async function createStudent(params: {
  schoolId: string;
  jenjang: Jenjang;
  nama: string;
  nisn?: string;
  tanggalLahir?: Date;
}) {
  const [claimToken, referralCode] = await Promise.all([
    generateUniqueClaimToken(),
    generateUniqueStudentReferralCode(),
  ]);
  return prisma.student.create({
    data: {
      schoolId: params.schoolId,
      jenjang: params.jenjang,
      nama: params.nama,
      nisn: params.nisn && params.nisn.length > 0 ? params.nisn : null,
      tanggalLahir: params.tanggalLahir ?? null,
      jalur: "A",
      claimToken,
      referralCode,
      claimStatus: "belum_klaim",
      status: "pending",
    },
  });
}
