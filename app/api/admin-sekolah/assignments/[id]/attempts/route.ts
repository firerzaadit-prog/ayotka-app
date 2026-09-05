import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { getRemainingSeconds } from "@/lib/exam/timing";

type RouteParams = { params: Promise<{ id: string }> };

/** Tiket 4.9: daftar attempt siswa untuk satu penugasan, dipakai admin sekolah untuk pause/resume. */
export async function GET(_request: Request, { params }: RouteParams) {
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

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      package: { select: { nama: true } },
      class: { select: { tingkat: true, namaRombel: true } },
    },
  });
  if (!assignment || assignment.schoolId !== schoolId) {
    return NextResponse.json({ error: "Penugasan tidak ditemukan." }, { status: 404 });
  }

  const attempts = await prisma.attempt.findMany({
    where: { assignmentId: id },
    orderBy: { mulaiAt: "desc" },
    include: { student: { select: { nama: true } } },
  });

  return NextResponse.json({
    assignment,
    attempts: attempts.map((a) => ({
      id: a.id,
      studentNama: a.student.nama,
      status: a.status,
      sisaDetik: a.status === "berjalan" ? getRemainingSeconds(a) : a.sisaDetik,
      skorAkhir: a.skorAkhir,
      tabSwitchCount: a.tabSwitchCount,
    })),
  });
}
