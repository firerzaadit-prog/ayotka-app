import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { buildKesiapanAntarSekolah } from "@/lib/analytics/global";

/**
 * Kesiapan TKA lintas sekolah - dipakai halaman dashboard dinas pendidikan
 * (akses baca saja). admin_pusat juga diizinkan supaya tim AyoTKA sendiri
 * bisa melihat/verifikasi data yang sama tanpa akun dinas terpisah.
 */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat", "dinas_pendidikan");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const url = new URL(request.url);
  const jenjang = url.searchParams.get("jenjang");

  const perSekolah = await buildKesiapanAntarSekolah({
    jenjang: jenjang === "SD" || jenjang === "SMP" ? jenjang : null,
    wilayah: url.searchParams.get("wilayah"),
  });

  return NextResponse.json({ perSekolah });
}
