import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

/**
 * Daftar sekolah aktif utk dropdown filter di halaman Analitik Global dinas
 * pendidikan. Field SENGAJA minimal (id/nama/jenjang/status) - beda dari
 * /api/admin-pusat/schools yang menyertakan kodeSekolah (kode klaim
 * registrasi Jalur A siswa): dinas_pendidikan cuma perlu identitas sekolah
 * utk memfilter, tidak boleh bisa melihat kode klaim sekolah lain di luar
 * kewenangannya.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat", "dinas_pendidikan");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schools = await prisma.school.findMany({
    where: { status: "aktif" },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, jenjang: true, status: true },
  });

  return NextResponse.json({ schools });
}
