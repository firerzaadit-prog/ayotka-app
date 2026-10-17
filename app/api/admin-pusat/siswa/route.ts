import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { adalahEmailSintetis } from "@/lib/billing/pembayaran-affiliate";

/**
 * Tampilan gabungan seluruh siswa admin pusat (Bagian 5 brief, poin 6:
 * "Input Siswa di Semua Sekolah") - lintas sekolah & lintas jalur (A/B),
 * beda dari GET /api/admin-sekolah/siswa yang selalu Jalur A dan satu
 * sekolah saja. Menambah siswa tetap lewat endpoint admin-sekolah/siswa yang
 * sudah ada (sudah menerima admin_pusat + resolusi sekolah lewat schoolId);
 * menghapus lewat DELETE /api/admin-pusat/siswa/[id] dan POST
 * /api/admin-pusat/siswa/hapus-massal (Jalur A maupun Jalur B).
 *
 * Hanya kolom yang dipakai daftar yang dikirim (tanpa kode klaim dan data pribadi lain); email akun ikut supaya
 * pengguna bisa dikenali dan dicari (siswa Jalur A yang masuk dengan NISN memakai email sintetis, yang di sini
 * dikirim sebagai null supaya tidak tampil sebagai email sungguhan).
 */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId");
  const jalur = url.searchParams.get("jalur");

  const rows = await prisma.student.findMany({
    where: {
      deletedAt: null,
      ...(schoolId ? { schoolId } : {}),
      ...(jalur === "A" || jalur === "B" ? { jalur } : {}),
    },
    orderBy: [{ school: { nama: "asc" } }, { nama: "asc" }],
    select: {
      id: true,
      nama: true,
      nisn: true,
      jenjang: true,
      jalur: true,
      claimStatus: true,
      status: true,
      lulusAt: true,
      school: { select: { id: true, nama: true } },
      user: { select: { email: true } },
    },
  });

  const students = rows.map(({ user, ...siswa }) => ({
    ...siswa,
    email: user && !adalahEmailSintetis(user.email) ? user.email : null,
  }));

  return NextResponse.json({ students });
}
