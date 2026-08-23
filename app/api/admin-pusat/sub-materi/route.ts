import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { subMateriCreateSchema } from "@/lib/validations/taxonomy";

export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const materiId = new URL(request.url).searchParams.get("materiId");
  if (!materiId) {
    return NextResponse.json({ error: "materiId wajib diisi." }, { status: 400 });
  }

  const subMateri = await prisma.subMateri.findMany({
    where: { materiId },
    orderBy: { urutan: "asc" },
    include: { _count: { select: { kompetensi: true } } },
  });

  return NextResponse.json({ subMateri });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = subMateriCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const materi = await prisma.materi.findUnique({ where: { id: parsed.data.materiId } });
  if (!materi) {
    return NextResponse.json({ error: "Materi tidak ditemukan." }, { status: 404 });
  }

  const subMateri = await prisma.subMateri.create({ data: parsed.data });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "sub_materi",
    entitasId: subMateri.id,
    after: subMateri,
    ip: getClientIp(request),
  });

  return NextResponse.json({ subMateri }, { status: 201 });
}
