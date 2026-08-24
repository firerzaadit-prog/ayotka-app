import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { schoolUpdateSchema } from "@/lib/validations/school";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const school = await prisma.school.findUnique({
    where: { id },
    include: { schoolUsers: { include: { user: true } } },
  });

  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ school });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schoolUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const before = await prisma.school.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  const { npsn, alamat, ...rest } = parsed.data;
  const school = await prisma.school.update({
    where: { id },
    data: {
      ...rest,
      ...(npsn !== undefined ? { npsn: npsn.length > 0 ? npsn : null } : {}),
      ...(alamat !== undefined ? { alamat: alamat.length > 0 ? alamat : null } : {}),
    },
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "schools",
    entitasId: school.id,
    before,
    after: school,
    ip: getClientIp(request),
  });

  return NextResponse.json({ school });
}

/**
 * Bagian 5 brief ("hapus sekolah TIDAK boleh cascade hapus data siswa/nilai"):
 * relasi Class/Student/Assignment ke School memakai onDelete Restrict di
 * skema, jadi Postgres sendiri yang menolak hapus sekolah yang masih punya
 * data - di sini cuma menerjemahkan penolakan itu (P2003) jadi pesan yang
 * jelas. Sekolah kosong (baru dibuat, salah input, dst.) tetap bisa dihapus
 * permanen; sekolah dengan data sungguhan diarahkan pakai status Suspend.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.school.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  try {
    await prisma.school.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Sekolah ini masih punya data terkait (siswa, rombel, atau penugasan) sehingga tidak bisa dihapus permanen. Gunakan tombol Suspend untuk menonaktifkannya tanpa kehilangan data.",
        },
        { status: 409 },
      );
    }
    throw error;
  }

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "schools",
    entitasId: id,
    before,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
