import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { buildAnalitikGlobal, buildStatistikMataPelajaran } from "@/lib/analytics/global";

/**
 * Analitik Global dinas pendidikan - data & bentuk respons SAMA PERSIS
 * dengan /api/admin-pusat/analitik (reuse fungsi lib/analytics/global.ts
 * yang sama), cuma beda role yang diizinkan. admin_pusat juga diizinkan
 * supaya tim AyoTKA sendiri bisa verifikasi tanpa akun dinas terpisah, sama
 * seperti /api/dinas-pendidikan/kesiapan.
 */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat", "dinas_pendidikan");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const url = new URL(request.url);
  const jenjang = url.searchParams.get("jenjang");

  try {
    const filter = {
      schoolId: url.searchParams.get("schoolId"),
      jenjang: jenjang === "SD" || jenjang === "SMP" ? (jenjang as "SD" | "SMP") : null,
      subjectId: url.searchParams.get("subjectId"),
      wilayah: url.searchParams.get("wilayah"),
    };
    const [result, statistikMapel] = await Promise.all([
      buildAnalitikGlobal(filter),
      buildStatistikMataPelajaran(filter),
    ]);
    return NextResponse.json({ ...result, statistikMapel });
  } catch (error) {
    console.error("Gagal memuat analitik global (dinas pendidikan)", error);
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json(
      { error: `Gagal memuat analitik: ${message}` },
      { status: 500 },
    );
  }
}
