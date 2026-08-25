import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { buildAnalitikGlobal } from "@/lib/analytics/global";

/** Tiket 7.1: analitik lintas sekolah - filter sekolah/jenjang/mapel/wilayah, admin pusat saja. */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const url = new URL(request.url);
  const jenjang = url.searchParams.get("jenjang");
  const result = await buildAnalitikGlobal({
    schoolId: url.searchParams.get("schoolId"),
    jenjang: jenjang === "SD" || jenjang === "SMP" ? jenjang : null,
    subjectId: url.searchParams.get("subjectId"),
    wilayah: url.searchParams.get("wilayah"),
  });

  return NextResponse.json(result);
}
