import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { kompetensiCreateSchema } from "@/lib/validations/taxonomy";
import { kompetensiSudahDipakai } from "@/lib/soal/kompetensi-ref";

export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const elemenId = new URL(request.url).searchParams.get("elemenId");
  if (!elemenId) {
    return NextResponse.json({ error: "elemenId wajib diisi." }, { status: 400 });
  }

  const kompetensi = await prisma.kompetensi.findMany({
    where: { elemenId },
    orderBy: { subElemen: "asc" },
  });

  return NextResponse.json({ kompetensi });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = kompetensiCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const elemen = await prisma.elemen.findUnique({ where: { id: parsed.data.elemenId } });
  if (!elemen) {
    return NextResponse.json({ error: "Elemen tidak ditemukan." }, { status: 404 });
  }

  if (await kompetensiSudahDipakai(parsed.data.elemenId, parsed.data.subElemen, parsed.data.deskripsi)) {
    return NextResponse.json(
      { error: "Kombinasi Sub Elemen + Kompetensi ini sudah ada di elemen yang sama." },
      { status: 409 },
    );
  }

  const kompetensi = await prisma.kompetensi.create({ data: parsed.data });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "kompetensi",
    entitasId: kompetensi.id,
    after: kompetensi,
    ip: getClientIp(request),
  });

  return NextResponse.json({ kompetensi }, { status: 201 });
}
