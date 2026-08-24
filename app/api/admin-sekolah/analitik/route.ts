import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { buildAnalitikSekolah } from "@/lib/analytics/sekolah";

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
  const { jumlahAttempt, kompetensi, ranking } = await buildAnalitikSekolah(schoolId, {
    classId: url.searchParams.get("classId"),
    subjectId: url.searchParams.get("subjectId"),
  });

  return NextResponse.json({
    jumlahAttempt,
    kompetensiTerlemah: kompetensi.slice(0, 10),
    ranking,
  });
}
