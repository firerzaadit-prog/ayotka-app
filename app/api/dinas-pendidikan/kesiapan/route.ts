import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { buildKesiapanAntarSekolah } from "@/lib/analytics/global";
import { getDinasWilayah } from "@/lib/dinas/wilayah";

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

  // Ambil wilayah cakupan dinas pendidikan
  let kabupatenKota: string | null = null;
  if (user.role === "dinas_pendidikan") {
    kabupatenKota = await getDinasWilayah(user.id);
  }

  const url = new URL(request.url);
  const jenjang = url.searchParams.get("jenjang");

  const perSekolah = await buildKesiapanAntarSekolah({
    jenjang: jenjang === "SD" || jenjang === "SMP" ? jenjang : null,
    wilayah: url.searchParams.get("wilayah"),
    kabupatenKota,
  });

  return NextResponse.json({ perSekolah });
}

