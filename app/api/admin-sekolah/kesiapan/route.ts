import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { buildKesiapanSekolah } from "@/lib/analytics/sekolah";

/**
 * Persentase kesiapan TKA sekolah (gabungan Matematika + Bahasa Indonesia,
 * dan rincian per mapel), berdasarkan skor terbaik tiap siswa dan kategori
 * capaian resmi Kemendikdasmen - lihat lib/exam/scoring.ts.
 */
export async function GET() {
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

  const kesiapan = await buildKesiapanSekolah(schoolId);
  return NextResponse.json({ kesiapan });
}
