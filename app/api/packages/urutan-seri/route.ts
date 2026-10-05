import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { urutanSeriTerpakai } from "@/lib/exam/seri-mandiri";
import { urutanSeriBerikutnya } from "@/lib/exam/seri-jadwal";

const querySchema = z.object({
  subjectId: z.string().uuid(),
  jenjang: z.enum(["SD", "SMP"]),
  exclude: z.string().uuid().optional(),
});

/**
 * Urutan seri yang sudah dipakai paket Mandiri pada satu mapel dan jenjang (lintas pemilik) + urutan kosong berikutnya. Dipakai
 * form paket (components/soal) untuk mencegah nomor ganda sebelum disimpan dan menyarankan nomor berikutnya. Hanya
 * angka urutan yang dikembalikan - tidak ada data paket lain. Gerbang yang sebenarnya tetap di POST/PATCH paket.
 * `exclude` = paket yang sedang diedit (nomornya sendiri tidak dihitung terpakai).
 */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    subjectId: url.searchParams.get("subjectId"),
    jenjang: url.searchParams.get("jenjang"),
    exclude: url.searchParams.get("exclude") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Mata pelajaran atau jenjang tidak valid." }, { status: 400 });
  }

  const terpakai = await urutanSeriTerpakai(
    { subjectId: parsed.data.subjectId, jenjang: parsed.data.jenjang },
    parsed.data.exclude,
  );
  return NextResponse.json(
    { terpakai, berikutnya: urutanSeriBerikutnya(terpakai) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
