import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { executeImport, ImportBlockedError } from "@/lib/soal-import/execute";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  subjectId: z.string().uuid(),
  tingkatList: z.array(z.coerce.number().int().min(1).max(12)).min(1, "Pilih minimal satu tingkat kelas"),
  durasiMenit: z.coerce.number().int().min(1, "Durasi wajib diisi"),
  kategori: z.enum(["mandiri", "nasional"]),
  levelBloomOverrides: z.record(z.string(), z.enum(["L1", "L2", "L3"])).default({}),
});

/** Konfirmasi impor: buat Package (draft) + Stimulus + Question dari paket sumber (dokumen Bagian 08 langkah 5). */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  if (!checkRateLimit(`soal-import:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan impor, coba lagi sebentar lagi." }, { status: 429 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, { status: 400 });
  }

  try {
    const result = await executeImport({
      sourcePaketId: id,
      subjectId: parsed.data.subjectId,
      tingkatList: [...new Set(parsed.data.tingkatList)].sort((a, b) => a - b),
      durasiMenit: parsed.data.durasiMenit,
      kategori: parsed.data.kategori,
      levelBloomOverrides: parsed.data.levelBloomOverrides,
      importedBy: user.id,
    });

    await logAudit({
      userId: user.id,
      aksi: "create",
      entitas: "packages",
      entitasId: result.package.id,
      after: { impor: "soal-ayotka-id", sourcePaketId: id, jumlahSoal: result.jumlahSoal },
      ip: getClientIp(request),
    });

    return NextResponse.json({ package: result.package, jumlahSoal: result.jumlahSoal }, { status: 201 });
  } catch (err) {
    if (err instanceof ImportBlockedError) {
      return NextResponse.json(
        { error: "Masih ada soal yang belum siap diimpor.", blocked: err.blocked },
        { status: 422 },
      );
    }
    console.error("Gagal mengeksekusi impor soal", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengimpor paket." },
      { status: 400 },
    );
  }
}
