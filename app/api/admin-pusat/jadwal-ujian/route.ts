import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

/**
 * Pantauan jadwal ujian (assignment) lintas semua sekolah untuk admin pusat -
 * supaya tidak perlu buka dashboard tiap admin sekolah satu-satu untuk lihat
 * jendela waktu ujian mana saja yang sedang/akan berlangsung.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const assignments = await prisma.assignment.findMany({
    orderBy: { mulai: "desc" },
    take: 300,
    include: {
      school: { select: { nama: true } },
      package: { select: { nama: true, jumlahSoal: true, durasiMenit: true } },
      class: { select: { tingkat: true, namaRombel: true } },
      _count: { select: { attempts: true } },
    },
  });

  return NextResponse.json({
    assignments: assignments.map((a) => ({
      id: a.id,
      sekolahNama: a.school?.nama ?? "-",
      paketNama: a.package.nama,
      kelas: a.class ? `${a.class.tingkat}${a.class.namaRombel}` : "-",
      mulai: a.mulai,
      selesai: a.selesai,
      metodeDistribusi: a.metodeDistribusi,
      isActive: a.isActive,
      jumlahAttempt: a._count.attempts,
    })),
  });
}
