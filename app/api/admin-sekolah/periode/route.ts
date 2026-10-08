import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { akhirEfektif, ambilPeriodeSekolah, statusPeriode } from "@/lib/billing/periode-sekolah";

/**
 * Daftar periode langganan sekolah (terbaru di atas, tanpa yang dicabut) - read-only. Dipakai pemilih periode di
 * halaman Analitik. Pengelolaan periode hanya lewat admin pusat (/api/admin-pusat/schools/[id]/periode).
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireRole("admin_sekolah", "admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }
  const url = new URL(request.url);
  const schoolId = await resolveSchoolId(user, url.searchParams.get("schoolId"));
  if (!schoolId) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const now = new Date();
  const periode = await ambilPeriodeSekolah(prisma, schoolId);
  return NextResponse.json({
    periode: periode
      .map((p) => ({
        id: p.id,
        nama: p.nama,
        mulai: p.mulai,
        berakhir: p.berakhir,
        akhirEfektif: akhirEfektif(p),
        status: statusPeriode(p, now),
      }))
      .reverse(),
  });
}
