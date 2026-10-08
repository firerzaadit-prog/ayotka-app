import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { buildDaftarSiswaKesiapanAntarSekolah } from "@/lib/analytics/global";
import { bacaRentangTanggal } from "@/lib/analytics/rentang";
import { KESIAPAN_SUBJECTS } from "@/lib/analytics/kesiapan";
import { bacaCakupanDinas, bacaFilterWilayahDinas } from "@/lib/dinas/wilayah";
import type { KategoriKesiapan } from "@/lib/exam/scoring";

const KATEGORI_VALID: readonly string[] = ["kurang", "memadai", "baik", "istimewa"];

/**
 * Daftar siswa lintas sekolah untuk satu mata pelajaran Kesiapan TKA,
 * opsional difilter per kategori capaian - drill-down dari tabel ringkasan
 * kesiapan per sekolah di dashboard dinas pendidikan (akses baca saja).
 * admin_pusat juga diizinkan, sama seperti /api/dinas-pendidikan/kesiapan.
 *
 * Jika user adalah dinas_pendidikan, data otomatis difilter berdasarkan
 * wilayah (provinsi atau kota/kabupaten) yang ditetapkan admin pusat; filter provinsi/kabupatenKota/statusSekolah sama
 * seperti /api/dinas-pendidikan/kesiapan.
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat", "dinas_pendidikan");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  // Wilayah cakupan dinas pendidikan (gagal tertutup: akun dinas tanpa wilayah ditolak, bukan melihat semua wilayah)
  const cakupan = await bacaCakupanDinas(user);
  if ("galat" in cakupan) return cakupan.galat;
  const url = new URL(request.url);
  const wilayahFilter = bacaFilterWilayahDinas(cakupan, url);
  if ("galat" in wilayahFilter) return wilayahFilter.galat;
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
  const waktu = bacaRentangTanggal(url);
  if ("galat" in waktu) return waktu.galat;

  const siswa = await buildDaftarSiswaKesiapanAntarSekolah({
    subjectNama: mapel,
    kategori: kategoriParam as KategoriKesiapan | null,
    jenjang: jenjang === "SD" || jenjang === "SMP" ? jenjang : null,
    wilayah: url.searchParams.get("wilayah"),
    schoolId: url.searchParams.get("schoolId"),
    ...wilayahFilter,
    ...waktu.rentang,
  });

  return NextResponse.json({ siswa });
}

