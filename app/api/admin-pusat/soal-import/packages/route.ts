import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { listPublishedPackages } from "@/lib/soal-import/source-db";

/** Daftar paket berstatus `diterbitkan` di soal.ayotka.id, ditandai mana yang sudah pernah diimpor. */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  let sourcePackages;
  try {
    sourcePackages = await listPublishedPackages();
  } catch (err) {
    console.error("Gagal membaca daftar paket dari soal.ayotka.id", err);
    return NextResponse.json(
      { error: "Gagal terhubung ke soal.ayotka.id. Coba lagi sebentar lagi." },
      { status: 502 },
    );
  }

  const importLogs = await prisma.soalImportLog.findMany({
    where: { sourcePaketId: { in: sourcePackages.map((p) => p.id) } },
    select: { sourcePaketId: true },
  });
  const sudahDiimporIds = new Set(importLogs.map((l) => l.sourcePaketId));

  const packages = sourcePackages.map((p) => ({
    ...p,
    sudahDiimpor: sudahDiimporIds.has(p.id),
  }));

  return NextResponse.json({ packages });
}
