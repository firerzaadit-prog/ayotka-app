import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ringkasMaster } from "@/lib/indikator/master-simpan";

/** Ringkasan master indikator resmi + seberapa banyak soal yang sudah tertaut (halaman Indikator Resmi, admin pusat). */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }
  const ringkasan = await ringkasMaster(prisma);
  return NextResponse.json({ ringkasan });
}
