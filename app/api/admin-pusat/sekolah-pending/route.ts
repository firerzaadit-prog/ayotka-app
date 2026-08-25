import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

/**
 * Tiket 7.4 (Bagian 5 brief, poin 10 "Verifikasi"): antrean sekolah yang
 * dibuat OTOMATIS dari input nama sekolah bebas (bukan pilih dari daftar
 * resmi) saat registrasi siswa mandiri - lihat app/api/registrasi/mandiri/route.ts.
 * Dibedakan dari sekolah yang memang dibuat admin pusat sendiri lewat
 * kuota_siswa: 0 - satu-satunya cara baris itu bisa punya kuota 0 adalah
 * lewat jalur otomatis ini (form CRUD admin pusat mewajibkan kuota >= 1,
 * lihat schoolCreateSchema), jadi tidak perlu kolom penanda baru.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const pending = await prisma.school.findMany({
    where: { status: "pending_verifikasi", kuotaSiswa: 0 },
    orderBy: { nama: "asc" },
    include: {
      students: {
        where: { deletedAt: null },
        select: { id: true, nama: true, jenjang: true, tingkat: true },
      },
    },
  });

  return NextResponse.json({ pending });
}
