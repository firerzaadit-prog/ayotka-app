import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { getActiveAssignmentsFor, getSelfSelectPackagesFor, getSelfSelectTryOutGroupsFor } from "@/lib/exam/visibility";

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

  const [assignments, packages, tryOutGroups, attempts] = await Promise.all([
    isJalurA ? getActiveAssignmentsFor(student) : Promise.resolve([]),
    isJalurA ? Promise.resolve([]) : getSelfSelectPackagesFor(student),
    isJalurA ? Promise.resolve([]) : getSelfSelectTryOutGroupsFor(student),
    prisma.attempt.findMany({
      where: { studentId: student.id },
      select: {
        id: true,
        assignmentId: true,
        packageId: true,
        status: true,
        skorAkhir: true,
        mulaiAt: true,
        // Bagian 8/10: attempt untuk try out grup tercatat lewat packageId
        // VARIASI yang diacak, bukan groupId-nya sendiri - sertakan
        // tryOutGroupId di sini supaya siswa lihat "sudah dikerjakan" pada
        // entri grup yang benar di halaman, apa pun variasi yang dia dapat.
        package: { select: { tryOutGroupId: true } },
      },
      orderBy: { mulaiAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    jalur: student.jalur,
    assignments,
    packages,
    tryOutGroups,
    attempts: attempts.map((a) => ({
      id: a.id,
      assignmentId: a.assignmentId,
      packageId: a.packageId,
      tryOutGroupId: a.package.tryOutGroupId,
      status: a.status,
      skorAkhir: a.skorAkhir,
      mulaiAt: a.mulaiAt,
    })),
  });
}
