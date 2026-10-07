import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { muatRekapPenugasan } from "@/lib/exam/rekap-bersama-data";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Rekap hasil Try Out Bersama untuk admin sekolah: peringkat, statistik, dan siapa yang belum mengerjakan.
 * Nilai tiap siswa = percobaan pertamanya (lihat lib/exam/rekap-bersama.ts). Hanya penugasan milik sekolah ini.
 */
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
  const rekap = await muatRekapPenugasan(schoolId, id);
  if (!rekap) {
    return NextResponse.json({ error: "Penugasan tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ ...rekap, sekarang: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
