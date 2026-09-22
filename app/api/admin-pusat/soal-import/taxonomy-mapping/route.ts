import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { createTaxonomyMapping } from "@/lib/soal-import/taxonomy-resolver";

const bodySchema = z.object({
  elemen: z.string().trim().min(1),
  subElemen: z.string().trim().min(1).nullable(),
  kompetensi: z.string().trim().min(1).nullable(),
  kompetensiId: z.string().uuid(),
});

/**
 * Simpan satu pemetaan label taksonomi sumber -> Kompetensi ayotka-app,
 * dipanggil saat admin memilih dari dropdown di halaman preview (dokumen
 * Bagian 07 langkah 2). Sekali disimpan, dipakai ulang otomatis oleh
 * buildImportPreview untuk semua paket lain dengan label sama.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, { status: 400 });
  }
  const { elemen, subElemen, kompetensi, kompetensiId } = parsed.data;

  const kompetensiExists = await prisma.kompetensi.findUnique({ where: { id: kompetensiId }, select: { id: true } });
  if (!kompetensiExists) {
    return NextResponse.json({ error: "Kompetensi tujuan tidak ditemukan." }, { status: 404 });
  }

  const mapping = await createTaxonomyMapping(prisma, {
    source: { elemen, subElemen, kompetensi },
    kompetensiId,
    createdBy: user.id,
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "taxonomy_mappings",
    entitasId: mapping.id,
    after: mapping,
    ip: getClientIp(request),
  });

  return NextResponse.json({ mapping }, { status: 201 });
}
