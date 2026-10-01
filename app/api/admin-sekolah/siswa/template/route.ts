import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { buildStudentImportTemplate } from "@/lib/students/excel-template";

/**
 * Unduh template Excel resmi untuk pengisian import massal data siswa.
 * Dapat diakses oleh admin_sekolah maupun admin_pusat.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const buffer = await buildStudentImportTemplate();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-import-siswa-ayotka.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
