import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";

/**
 * Tiket 5.7: dashboard analitik admin sekolah - per kelas, per kompetensi,
 * ranking siswa. Admin-only by design (Bagian 7 brief: "Ranking/peringkat
 * siswa ... tidak pernah ditampilkan ke siswa") - requireRole di bawah ini
 * menolak siswa sama sekali, bukan cuma menyembunyikan UI-nya.
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireRole("admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId") || null;
  const subjectId = url.searchParams.get("subjectId") || null;

  const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });

  const attempts = await prisma.attempt.findMany({
    where: {
      status: { in: ["selesai", "kedaluwarsa"] },
      student: {
        schoolId,
        deletedAt: null,
        ...(classId && activeYear
          ? { enrollments: { some: { classId, academicYearId: activeYear.id } } }
          : {}),
      },
      ...(subjectId ? { package: { subjectId } } : {}),
    },
    select: {
      id: true,
      skorAkhir: true,
      student: { select: { id: true, nama: true } },
      competencyScores: {
        select: {
          jmlBenar: true,
          jmlSoal: true,
          kompetensi: {
            select: {
              id: true,
              kode: true,
              deskripsi: true,
              subMateri: { select: { materi: { select: { nama: true } } } },
            },
          },
        },
      },
    },
  });

  const kompetensiMap = new Map<
    string,
    { kode: string; deskripsi: string; materi: string; jmlBenar: number; jmlSoal: number }
  >();
  const studentMap = new Map<string, { nama: string; totalSkor: number; jumlahAttempt: number }>();

  for (const a of attempts) {
    if (a.skorAkhir != null) {
      const existing = studentMap.get(a.student.id) ?? {
        nama: a.student.nama,
        totalSkor: 0,
        jumlahAttempt: 0,
      };
      existing.totalSkor += a.skorAkhir;
      existing.jumlahAttempt += 1;
      studentMap.set(a.student.id, existing);
    }

    for (const cs of a.competencyScores) {
      const k = cs.kompetensi;
      const existing = kompetensiMap.get(k.id) ?? {
        kode: k.kode,
        deskripsi: k.deskripsi,
        materi: k.subMateri.materi.nama,
        jmlBenar: 0,
        jmlSoal: 0,
      };
      existing.jmlBenar += cs.jmlBenar;
      existing.jmlSoal += cs.jmlSoal;
      kompetensiMap.set(k.id, existing);
    }
  }

  const kompetensi = Array.from(kompetensiMap.values())
    .map((k) => ({ ...k, persentase: k.jmlSoal > 0 ? (k.jmlBenar / k.jmlSoal) * 100 : 0 }))
    .sort((a, b) => a.persentase - b.persentase);

  const ranking = Array.from(studentMap.entries())
    .map(([studentId, s]) => ({
      studentId,
      nama: s.nama,
      rataRata: s.totalSkor / s.jumlahAttempt,
      jumlahAttempt: s.jumlahAttempt,
    }))
    .sort((a, b) => b.rataRata - a.rataRata);

  return NextResponse.json({
    jumlahAttempt: attempts.length,
    kompetensiTerlemah: kompetensi.slice(0, 10),
    ranking,
  });
}
