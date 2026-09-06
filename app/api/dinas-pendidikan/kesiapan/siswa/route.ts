import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { buildDaftarSiswaKesiapanAntarSekolah } from "@/lib/analytics/global";
import { KESIAPAN_SUBJECTS } from "@/lib/analytics/kesiapan";
import type { KategoriKesiapan } from "@/lib/exam/scoring";

const KATEGORI_VALID: readonly string[] = ["kurang", "memadai", "baik", "istimewa"];

/**
 * Daftar siswa lintas sekolah untuk satu mata pelajaran Kesiapan TKA,
 * opsional difilter per kategori capaian - drill-down dari tabel ringkasan
 * kesiapan per sekolah di dashboard dinas pendidikan (akses baca saja).
 * admin_pusat juga diizinkan, sama seperti /api/dinas-pendidikan/kesiapan.
 */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat", "dinas_pendidikan");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
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

  const jenjang = url.searchParams.get("jenjang");

  const siswa = await buildDaftarSiswaKesiapanAntarSekolah({
    subjectNama: mapel,
    kategori: kategoriParam as KategoriKesiapan | null,
    jenjang: jenjang === "SD" || jenjang === "SMP" ? jenjang : null,
    wilayah: url.searchParams.get("wilayah"),
    schoolId: url.searchParams.get("schoolId"),
  });

  return NextResponse.json({ siswa });
}
