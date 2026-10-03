import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { buildKesiapanSekolah } from "@/lib/analytics/sekolah";
import { bacaRentangPeriode } from "@/lib/analytics/rentang";

/**
 * Persentase kesiapan TKA sekolah (gabungan Matematika + Bahasa Indonesia,
 * dan rincian per mapel), berdasarkan skor terbaik tiap siswa dan kategori
 * capaian resmi Kemendikdasmen - lihat lib/exam/scoring.ts.
 */
export async function GET(request: Request) {
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

  const hasilRentang = await bacaRentangPeriode(new URL(request.url), schoolId);
  if ("galat" in hasilRentang) return hasilRentang.galat;

  const kesiapan = await buildKesiapanSekolah(schoolId, hasilRentang.rentang);
  return NextResponse.json({ kesiapan });
}
