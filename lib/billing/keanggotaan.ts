import "server-only";
import type { Student } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getActiveEntitlement, kursiSekolahTersedia } from "@/lib/billing/entitlements";
import { ambilPeriodeSekolah, pilihPeriodeBerjalan } from "@/lib/billing/periode-sekolah";
import { LABEL_KEANGGOTAAN, tentukanKeanggotaan, type Keanggotaan } from "@/lib/billing/keanggotaan-label";

/** Data siswa yang dibutuhkan untuk menentukan keanggotaan (sudah dimuat pemanggil: tanpa query tambahan untuk siswa mandiri). */
export type SiswaUntukKeanggotaan = Pick<Student, "id" | "schoolId" | "jalur" | "deletedAt" | "lulusAt">;

/**
 * Keanggotaan siswa saat ini untuk lencana di navbar. Urutannya sama dengan tipe akses ujian (lib/billing/akses-ujian.ts:
 * getTipeAkses):
 *  1. akses yang SEDANG berlaku (getActiveEntitlement + kode plan-nya): kursi sekolah, Semester, atau Bulanan;
 *  2. bila tidak ada, siswa Jalur A yang ditanggung sekolahnya sekarang (periode berjalan dan kursi tersedia, walau baris
 *     kursinya baru dibuat saat ia menekan Mulai) tetap Member Sekolah - bukan Gratis;
 *  3. selain itu Member Gratis (belum pernah berlangganan, sudah berakhir, alumni, atau kuota sekolah penuh).
 * Tidak pernah melempar karena kegagalan mengambil lencana tidak boleh merusak seluruh halaman siswa: bila galat, jatuh ke
 * Member Gratis dan dicatat di log.
 */
export async function getKeanggotaanSiswa(siswa: SiswaUntukKeanggotaan, now: Date = new Date()): Promise<Keanggotaan> {
  try {
    const aktif = await getActiveEntitlement(siswa.id);
    let hasil = tentukanKeanggotaan(null, now);
    if (aktif) {
      const plan = await prisma.plan.findUnique({ where: { id: aktif.entitlement.planId }, select: { kode: true } });
      if (plan) {
        hasil = tentukanKeanggotaan(
          { source: aktif.entitlement.source, planKode: plan.kode, startsAt: aktif.entitlement.startsAt, endsAt: aktif.entitlement.endsAt },
          now,
        );
      }
    }
    if (hasil.jenis !== "gratis") return hasil;

    if (siswa.schoolId && (await kursiSekolahTersedia(siswa, now))) {
      // Tanggal berlaku = akhir periode langganan sekolah; selama masa tenggang (sudah lewat) tanggalnya tidak ditampilkan.
      const periode = pilihPeriodeBerjalan(await ambilPeriodeSekolah(prisma, siswa.schoolId), now);
      const berakhir = periode && periode.berakhir.getTime() >= now.getTime() ? periode.berakhir.toISOString() : null;
      return { jenis: "sekolah", label: LABEL_KEANGGOTAAN.sekolah, berlakuSampai: berakhir };
    }
    return hasil;
  } catch (err) {
    console.error("[keanggotaan] gagal menentukan keanggotaan siswa:", err);
    return tentukanKeanggotaan(null, now);
  }
}
