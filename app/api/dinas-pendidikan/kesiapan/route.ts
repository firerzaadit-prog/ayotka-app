import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { buildKesiapanAntarSekolah } from "@/lib/analytics/global";
import { bacaRentangTanggal } from "@/lib/analytics/rentang";
import { bacaCakupanDinas } from "@/lib/dinas/wilayah";

/**
 * Kesiapan TKA lintas sekolah - dipakai halaman dashboard dinas pendidikan
 * (akses baca saja). admin_pusat juga diizinkan supaya tim AyoTKA sendiri
 * bisa melihat/verifikasi data yang sama tanpa akun dinas terpisah.
 *
 * Jika user adalah dinas_pendidikan, data otomatis difilter berdasarkan
 * kabupatenKota yang ditetapkan admin pusat.
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
  const kabupatenKota = cakupan.kabupatenKota;

  const url = new URL(request.url);
  const jenjang = url.searchParams.get("jenjang");
  const waktu = bacaRentangTanggal(url);
  if ("galat" in waktu) return waktu.galat;

  const perSekolah = await buildKesiapanAntarSekolah({
    jenjang: jenjang === "SD" || jenjang === "SMP" ? jenjang : null,
    wilayah: url.searchParams.get("wilayah"),
    kabupatenKota,
    ...waktu.rentang,
  });

  return NextResponse.json({ perSekolah });
}

