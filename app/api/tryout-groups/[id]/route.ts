import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { tryOutGroupCreateSchema, toNullableDate } from "@/lib/validations/question";

type RouteParams = { params: Promise<{ id: string }> };

async function assertOwnsGroup(userId: string, groupId: string): Promise<boolean> {
  const group = await prisma.tryOutGroup.findUnique({ where: { id: groupId }, select: { ownerId: true } });
  return group?.ownerId === userId;
}

export async function GET(_request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await assertOwnsGroup(user.id, id))) {
    return NextResponse.json({ error: "Try out tidak ditemukan." }, { status: 404 });
  }

  const group = await prisma.tryOutGroup.findUnique({
    where: { id },
    include: {
      subject: true,
      visibility: { include: { school: { select: { id: true, nama: true } } } },
      packages: {
        orderBy: { nama: "asc" },
        include: { _count: { select: { questions: { where: { deletedAt: null } } } } },
      },
    },
  });

  return NextResponse.json({ group });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await assertOwnsGroup(user.id, id))) {
    return NextResponse.json({ error: "Try out tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = tryOutGroupCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const before = await prisma.tryOutGroup.findUnique({ where: { id } });
  const { visibilityMode, visibilitySchoolIds, visibilityEntries, bukaMulai, bukaSelesai, ...rest } = parsed.data;

  const bukaMulaiDate = toNullableDate(bukaMulai);
  const bukaSelesaiDate = toNullableDate(bukaSelesai);
  const effectiveBukaMulai = bukaMulaiDate !== undefined ? bukaMulaiDate : (before?.bukaMulai ?? null);
  const effectiveBukaSelesai = bukaSelesaiDate !== undefined ? bukaSelesaiDate : (before?.bukaSelesai ?? null);
  if (effectiveBukaMulai && effectiveBukaSelesai && effectiveBukaSelesai <= effectiveBukaMulai) {
    return NextResponse.json({ error: "Waktu selesai harus setelah waktu mulai." }, { status: 400 });
  }

  let visibilityUpdate: Prisma.TryOutGroupUpdateInput["visibility"] = undefined;
  if (visibilityEntries && visibilityEntries.length > 0) {
    visibilityUpdate = {
      deleteMany: {},
      create: visibilityEntries.map((e) => ({
        targetType: e.targetType,
        ...(e.schoolId ? { schoolId: e.schoolId } : {}),
      })),
    };
  } else if (visibilityMode) {
    if (visibilityMode === "privat") {
      visibilityUpdate = { deleteMany: {} };
    } else if (visibilityMode === "semua" || visibilityMode === "publik") {
      visibilityUpdate = { deleteMany: {}, create: [{ targetType: visibilityMode }] };
    } else if (visibilityMode === "sekolah" && visibilitySchoolIds) {
      visibilityUpdate = {
        deleteMany: {},
        create: visibilitySchoolIds.map((sid: string) => ({ targetType: "sekolah" as const, schoolId: sid })),
      };
    }
  }

  const group = await prisma.tryOutGroup.update({
    where: { id },
    data: {
      ...rest,
      ...(bukaMulaiDate !== undefined ? { bukaMulai: bukaMulaiDate } : {}),
      ...(bukaSelesaiDate !== undefined ? { bukaSelesai: bukaSelesaiDate } : {}),
      ...(visibilityUpdate ? { visibility: visibilityUpdate } : {}),
    },
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "try_out_groups",
    entitasId: id,
    before,
    after: group,
    ip: getClientIp(request),
  });

  return NextResponse.json({ group });
}

/** Sama seperti paket - tidak dihapus permanen, cuma diarsipkan (variasi paket di dalamnya tetap aman untuk audit). */
export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await assertOwnsGroup(user.id, id))) {
    return NextResponse.json({ error: "Try out tidak ditemukan." }, { status: 404 });
  }

  const before = await prisma.tryOutGroup.findUnique({ where: { id } });
  const group = await prisma.tryOutGroup.update({ where: { id }, data: { status: "archived" } });

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "try_out_groups",
    entitasId: id,
    before,
    after: group,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
