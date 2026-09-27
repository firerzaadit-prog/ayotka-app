import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { getDinasWilayah } from "@/lib/dinas/wilayah";

/**
 * Daftar sekolah aktif utk dropdown filter di halaman Analitik Global dinas
 * pendidikan. Field SENGAJA minimal (id/nama/jenjang/status) - beda dari
 * /api/admin-pusat/schools yang menyertakan kodeSekolah (kode klaim
 * registrasi Jalur A siswa): dinas_pendidikan cuma perlu identitas sekolah
 * utk memfilter, tidak boleh bisa melihat kode klaim sekolah lain di luar
 * kewenangannya.
 *
 * Jika akun dinas punya kabupatenKota (ditetapkan admin pusat), hanya
 * sekolah di wilayah tersebut yang dikembalikan. Admin pusat melihat semua.
 */
export async function GET() {
  let user;
  try {
    user = await requireRole("admin_pusat", "dinas_pendidikan");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  // Dinas pendidikan: filter berdasarkan wilayah cakupan
  let kabupatenKotaFilter: string | null = null;
  if (user.role === "dinas_pendidikan") {
    kabupatenKotaFilter = await getDinasWilayah(user.id);
  }

  const schools = await prisma.school.findMany({
    where: {
      status: "aktif",
      ...(kabupatenKotaFilter ? { kabupatenKota: kabupatenKotaFilter } : {}),
    },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, jenjang: true, status: true, kabupatenKota: true },
  });

  return NextResponse.json({ schools });
}

