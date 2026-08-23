import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

/**
 * Mapel adalah data tetap (Bagian 3.2 brief: SD 2 mapel, SMP 4 mapel),
 * di-seed lewat scripts/seed-subjects.ts - endpoint ini read-only.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const subjects = await prisma.subject.findMany({ orderBy: [{ jenjang: "asc" }, { nama: "asc" }] });
  return NextResponse.json({ subjects });
}
