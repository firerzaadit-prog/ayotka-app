import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { academicYearCreateSchema } from "@/lib/validations/academic-year";

export async function GET() {
  try {
    await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const academicYears = await prisma.academicYear.findMany({ orderBy: { mulai: "desc" } });
  return NextResponse.json({ academicYears });
}

/**
 * Tahun ajaran bersifat global (tidak per sekolah - lihat Bagian 6 brief,
 * academic_years tidak punya school_id). Dibuat sebagai nonaktif dulu -
 * admin pusat mengaktifkannya secara eksplisit lewat
 * POST .../[id]/aktivasi setelah siap, supaya tidak ada tahun ajaran baru
 * yang tiba-tiba "mengambil alih" jadi tujuan Naik Kelas sebelum waktunya.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = academicYearCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  if (parsed.data.selesai <= parsed.data.mulai) {
    return NextResponse.json(
      { error: "Tanggal selesai harus setelah tanggal mulai." },
      { status: 400 },
    );
  }

  const academicYear = await prisma.academicYear.create({
    data: { ...parsed.data, isActive: false },
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "academic_years",
    entitasId: academicYear.id,
    after: academicYear,
    ip: getClientIp(request),
  });

  return NextResponse.json({ academicYear }, { status: 201 });
}
