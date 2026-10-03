import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { getRemainingSeconds } from "@/lib/exam/timing";
import { tutupPercobaanKedaluwarsa } from "@/lib/exam/tutup-kedaluwarsa";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Daftar attempt siswa untuk satu penugasan, versi admin pusat (lintas
 * sekolah, read-only - pause/resume tetap wewenang admin sekolah lewat
 * /admin-sekolah/ujian/[id]). Dipakai supaya admin pusat juga bisa
 * memicu Analisis AI & unduh rapor tanpa perlu masuk sebagai admin
 * sekolah yang bersangkutan.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      package: { select: { nama: true } },
      school: { select: { nama: true } },
    },
  });
  if (!assignment) {
    return NextResponse.json({ error: "Penugasan tidak ditemukan." }, { status: 404 });
  }

  // Tutup dulu percobaan yang waktunya sudah habis tapi belum pernah dibuka lagi siswanya, supaya status dan skor
  // yang tampil benar (lihat lib/exam/tutup-kedaluwarsa.ts). Gagal menutup tidak boleh menggagalkan daftar ini.
  await tutupPercobaanKedaluwarsa({ assignmentId: id }).catch((err) => {
    console.error("[tutup-kedaluwarsa] gagal untuk penugasan", id, err);
  });

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
