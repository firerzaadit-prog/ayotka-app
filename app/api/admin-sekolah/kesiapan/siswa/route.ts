import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { buildDaftarSiswaKesiapanSekolah } from "@/lib/analytics/sekolah";
import { KESIAPAN_SUBJECTS } from "@/lib/analytics/kesiapan";
import type { KategoriKesiapan } from "@/lib/exam/scoring";

const KATEGORI_VALID: readonly string[] = ["kurang", "memadai", "baik", "istimewa"];

/**
 * Daftar siswa 1 sekolah untuk satu mata pelajaran Kesiapan TKA, opsional
 * difilter per kategori capaian - drill-down dari kartu ringkasan kesiapan
 * di halaman Analitik admin sekolah.
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

  const url = new URL(request.url);
  const mapel = url.searchParams.get("mapel");
  const kesiapanSubjectNames: readonly string[] = KESIAPAN_SUBJECTS;
  if (!mapel || !kesiapanSubjectNames.includes(mapel)) {
    return NextResponse.json({ error: "Mata pelajaran tidak valid." }, { status: 400 });
  }

  const kategoriParam = url.searchParams.get("kategori");
  if (kategoriParam && !KATEGORI_VALID.includes(kategoriParam)) {
    return NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 });
  }

  const siswa = await buildDaftarSiswaKesiapanSekolah(schoolId, {
    subjectNama: mapel,
    kategori: kategoriParam as KategoriKesiapan | null,
  });

  return NextResponse.json({ siswa });
}
