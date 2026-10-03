import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { hitungKursiTerpakai } from "@/lib/students/create";
import {
  akhirEfektif,
  ambilPeriodeSekolah,
  pilihPeriodeRujukan,
  statusPeriode,
} from "@/lib/billing/periode-sekolah";

/**
 * Status kursi (seat) sekolah - read-only, dipakai dashboard admin sekolah supaya admin sekolah tahu kuota,
 * masa berlaku, dan apakah sekolah sudah "dibekukan" tanpa perlu tanya admin pusat. Pengelolaan (aktivasi/
 * perpanjangan) tetap cuma lewat admin pusat, lihat /api/admin-pusat/schools/[id]/periode. Semua nilai dihitung
 * dari periode langganan (bukan kolom salinan di tabel sekolah).
 */
export async function GET() {
  let user;
  try {
    user = await requireRole("admin_sekolah", "admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const now = new Date();
  const rujukan = pilihPeriodeRujukan(await ambilPeriodeSekolah(prisma, schoolId), now);
  const status = rujukan ? statusPeriode(rujukan, now) : null;
  const seatsUsed = await hitungKursiTerpakai(schoolId);
  // Hanya periode yang berlaku/akan berlaku yang membatasi penambahan siswa lewat kuota; periode berakhir ditangani
  // pesan "langganan berakhir" di bawah.
  const membatasi = status === "aktif" || status === "tenggang" || status === "akan_datang";

  return NextResponse.json({
    seatQuota: rujukan?.seatQuota ?? null,
    validUntil: rujukan?.berakhir ?? null,
    seatsUsed,
    /** true = tidak bisa menambah/impor siswa lagi sampai admin pusat menambah kuota. */
    isFull: membatasi && rujukan != null && seatsUsed >= rujukan.seatQuota,
    /** belum_aktif | akan_datang | aktif | tenggang | berakhir */
    status: status ?? "belum_aktif",
    mulai: rujukan?.mulai ?? null,
    /** Batas terakhir siswa masih bisa mulai ujian (akhir periode + masa tenggang). */
    tenggangSampai: rujukan ? akhirEfektif(rujukan) : null,
    namaPeriode: rujukan?.nama ?? null,
  });
}
