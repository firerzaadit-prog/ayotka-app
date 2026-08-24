import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

/**
 * Tampilan gabungan seluruh siswa admin pusat (Bagian 5 brief, poin 6:
 * "Input Siswa di Semua Sekolah") - lintas sekolah & lintas jalur (A/B),
 * beda dari GET /api/admin-sekolah/siswa yang selalu Jalur A dan satu
 * sekolah saja. Menambah/menghapus siswa tetap lewat endpoint
 * admin-sekolah/siswa yang sudah ada (sudah menerima admin_pusat + resolusi
 * sekolah lewat classId/schoolId).
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

  const students = await prisma.student.findMany({
    where: {
      deletedAt: null,
      ...(schoolId ? { schoolId } : {}),
      ...(jalur === "A" || jalur === "B" ? { jalur } : {}),
    },
    orderBy: [{ school: { nama: "asc" } }, { nama: "asc" }],
    include: {
      school: { select: { id: true, nama: true } },
      enrollments: {
        orderBy: { academicYear: { mulai: "desc" } },
        take: 1,
        include: { class: true },
      },
    },
  });

  return NextResponse.json({ students });
}
