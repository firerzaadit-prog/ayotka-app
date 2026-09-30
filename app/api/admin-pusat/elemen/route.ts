import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { elemenCreateSchema } from "@/lib/validations/taxonomy";

export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const subjectId = new URL(request.url).searchParams.get("subjectId");
  if (!subjectId) {
    return NextResponse.json({ error: "subjectId wajib diisi." }, { status: 400 });
  }

  const elemen = await prisma.elemen.findMany({
    where: { subjectId },
    orderBy: { urutan: "asc" },
    include: { _count: { select: { kompetensi: true } } },
  });

  return NextResponse.json({ elemen });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = elemenCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const subject = await prisma.subject.findUnique({ where: { id: parsed.data.subjectId } });
  if (!subject) {
    return NextResponse.json({ error: "Mapel tidak ditemukan." }, { status: 404 });
  }

  const elemen = await prisma.elemen.create({ data: parsed.data });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "elemen",
    entitasId: elemen.id,
    after: elemen,
    ip: getClientIp(request),
  });

  return NextResponse.json({ elemen }, { status: 201 });
}
