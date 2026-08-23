import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { uploadQuestionImage } from "@/lib/supabase/storage";

/** Tiket 2.4: upload gambar soal/opsi, validasi tipe & ukuran di server. */
export async function POST(request: Request) {
  try {
    await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
  }

  const result = await uploadQuestionImage(file);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result, { status: 201 });
}
