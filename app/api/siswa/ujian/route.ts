import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { getActiveAssignmentsFor, getSelfSelectPackagesFor } from "@/lib/exam/visibility";

/** Tiket 4.4 (Bagian 3.2 brief): daftar ujian terjadwal (Mode A) + paket latihan mandiri (Mode B). */
export async function GET() {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const student = await prisma.student.findFirst({ where: { userId: user.id } });
  if (!student) {
    return NextResponse.json({ error: "Profil siswa tidak ditemukan." }, { status: 404 });
  }

  const [assignments, packages, attempts] = await Promise.all([
    getActiveAssignmentsFor(student),
    getSelfSelectPackagesFor(student),
    prisma.attempt.findMany({
      where: { studentId: student.id },
      select: {
        id: true,
        assignmentId: true,
        packageId: true,
        status: true,
        skorAkhir: true,
        mulaiAt: true,
      },
      orderBy: { mulaiAt: "desc" },
    }),
  ]);

  return NextResponse.json({ assignments, packages, attempts });
}
