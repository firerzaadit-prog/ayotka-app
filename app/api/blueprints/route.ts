import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { blueprintCreateSchema } from "@/lib/validations/blueprint";

/**
 * Kisi-kisi (Tiket 2.7) tidak dimiliki sekolah/pusat secara eksklusif -
 * sesuai Bagian 6 brief, blueprints tidak punya owner_type/owner_id. Admin
 * pusat maupun admin sekolah bisa membuat & memakai kisi-kisi yang sama
 * untuk mapel/jenjang/tingkat yang cocok.
 */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId");

  const blueprints = await prisma.blueprint.findMany({
    where: subjectId ? { subjectId } : undefined,
    orderBy: { nama: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return NextResponse.json({ blueprints });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = blueprintCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const blueprint = await prisma.blueprint.create({
    data: { ...parsed.data, totalSoal: 0 },
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "blueprints",
    entitasId: blueprint.id,
    after: blueprint,
    ip: getClientIp(request),
  });

  return NextResponse.json({ blueprint }, { status: 201 });
}
