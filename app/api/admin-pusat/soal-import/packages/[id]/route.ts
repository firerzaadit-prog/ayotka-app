import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { buildImportPreview } from "@/lib/soal-import/preview";

type RouteParams = { params: Promise<{ id: string }> };

/** Preview lengkap satu paket sumber: soal (diterjemahkan), stimulus, dan status pemetaan taksonomi/level tiap soal. */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;

  let preview;
  try {
    preview = await buildImportPreview(id);
  } catch (err) {
    console.error("Gagal membangun preview impor", err);
    return NextResponse.json(
      { error: "Gagal terhubung ke soal.ayotka.id. Coba lagi sebentar lagi." },
      { status: 502 },
    );
  }

  if (!preview) {
    return NextResponse.json({ error: "Paket tidak ditemukan atau belum diterbitkan." }, { status: 404 });
  }

  return NextResponse.json({ preview });
}
