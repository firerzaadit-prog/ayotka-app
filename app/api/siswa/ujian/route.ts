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

  // Jalur A (sekolah): hanya ujian terjadwal. Jalur B (mandiri): hanya latihan mandiri.
  const isJalurA = student.jalur === "A";

  const [assignments, packages, attempts] = await Promise.all([
    isJalurA ? getActiveAssignmentsFor(student) : Promise.resolve([]),
    isJalurA ? Promise.resolve([]) : getSelfSelectPackagesFor(student),
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

  return NextResponse.json({ jalur: student.jalur, assignments, packages, attempts });
}
