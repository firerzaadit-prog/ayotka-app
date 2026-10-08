import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { buildAnalitikGlobal, buildStatistikMataPelajaran } from "@/lib/analytics/global";
import { bacaRentangTanggal } from "@/lib/analytics/rentang";
import { bacaFilterWilayahDinas } from "@/lib/dinas/wilayah";

/**
 * Tiket 7.1: analitik lintas sekolah - filter sekolah/jenjang/mapel/wilayah/rentang tanggal, admin pusat saja.
 * Pemetaan per wilayah seperti portal hasil TKA: ?provinsi=, ?kabupatenKota=, ?statusSekolah=negeri|swasta.
 */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const url = new URL(request.url);
  const jenjang = url.searchParams.get("jenjang");
  const waktu = bacaRentangTanggal(url);
  if ("galat" in waktu) return waktu.galat;
  const wilayahFilter = bacaFilterWilayahDinas({ provinsi: null, kabupatenKota: null }, url);
  if ("galat" in wilayahFilter) return wilayahFilter.galat;

  try {
    const filter = {
      schoolId: url.searchParams.get("schoolId"),
      jenjang: jenjang === "SD" || jenjang === "SMP" ? (jenjang as "SD" | "SMP") : null,
      subjectId: url.searchParams.get("subjectId"),
      wilayah: url.searchParams.get("wilayah"),
      ...wilayahFilter,
      ...waktu.rentang,
    };
    const [result, statistikMapel] = await Promise.all([
      buildAnalitikGlobal(filter),
      buildStatistikMataPelajaran(filter),
    ]);
    return NextResponse.json({ ...result, statistikMapel });
  } catch (error) {
    console.error("Gagal memuat analitik global", error);
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json(
      { error: `Gagal memuat analitik: ${message}` },
      { status: 500 },
    );
  }
}
