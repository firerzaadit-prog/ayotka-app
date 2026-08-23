import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const blueprint = await prisma.blueprint.findUnique({
    where: { id },
    include: { items: { include: { kompetensi: true } }, subject: true },
  });

  if (!blueprint) {
    return NextResponse.json({ error: "Kisi-kisi tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ blueprint });
}
