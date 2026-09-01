import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { assertOwnsPackage, getOwnerScope, assertGrupParalelOwnedBySelf } from "@/lib/packages/scope";
import { packageCreateSchema } from "@/lib/validations/question";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await assertOwnsPackage(user, id))) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  const pkg = await prisma.package.findUnique({
    where: { id },
    include: {
      subject: true,
      visibility: { include: { school: { select: { id: true, nama: true } } } },
      blueprint: { include: { items: { include: { kompetensi: true } } } },
      questions: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { kompetensi: true, _count: { select: { attemptAnswers: true } } },
      },
    },
  });

  return NextResponse.json({ package: pkg });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await assertOwnsPackage(user, id))) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = packageCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const before = await prisma.package.findUnique({ where: { id } });
  const { blueprintId, grupParalelId, visibilityMode, visibilitySchoolIds, visibilityEntries, ...rest } = parsed.data;

  // Distribusi lintas sekolah (visibility) cuma konsep milik paket pusat
  // (Tiket 2.8) - field ini diabaikan diam-diam kalau tetap dikirim
  // admin_sekolah, sama seperti visibility/route.ts (assertOwnedByPusat).
  const isPusat = user.role === "admin_pusat";
  let visibilityUpdate: Prisma.PackageUpdateInput["visibility"] = undefined;

  if (isPusat && visibilityEntries && visibilityEntries.length > 0) {
    // Mode dual-target: gunakan entries langsung (sekolah + mandiri sekaligus)
    visibilityUpdate = {
      deleteMany: {},
      create: visibilityEntries.map((e) => ({
        targetType: e.targetType,
        ...(e.schoolId ? { schoolId: e.schoolId } : {}),
      })),
    };
  } else if (isPusat && visibilityMode) {
    if (visibilityMode === "privat") {
      visibilityUpdate = { deleteMany: {} };
    } else if (visibilityMode === "semua" || visibilityMode === "publik") {
      visibilityUpdate = {
        deleteMany: {},
        create: [{ targetType: visibilityMode }],
      };
    } else if (visibilityMode === "sekolah" && visibilitySchoolIds) {
      visibilityUpdate = {
        deleteMany: {},
        create: visibilitySchoolIds.map((sid: string) => ({ targetType: "sekolah" as const, schoolId: sid })),
      };
    }
  }

  // grup_paralel_id dipakai lib/exam/distribution.ts memilih otomatis paket
  // segrup ke siswa mana pun yang pakai grup itu - cegah bergabung ke grup
  // yang anggotanya sudah dimiliki owner lain (lihat assertGrupParalelOwnedBySelf).
  let resolvedGrupParalelId: string | null | undefined;
  if (grupParalelId !== undefined) {
    resolvedGrupParalelId = grupParalelId.length > 0 ? grupParalelId : null;
    if (resolvedGrupParalelId) {
      const scope = await getOwnerScope(user);
      if (!scope || !(await assertGrupParalelOwnedBySelf(scope, resolvedGrupParalelId))) {
        return NextResponse.json(
          { error: "Grup paralel ini milik pihak lain, tidak bisa digabungkan." },
          { status: 403 },
        );
      }
    }
  }

  const pkg = await prisma.package.update({
    where: { id },
    data: {
      ...rest,
      ...(blueprintId !== undefined
        ? { blueprintId: blueprintId.length > 0 ? blueprintId : null }
        : {}),
      ...(resolvedGrupParalelId !== undefined ? { grupParalelId: resolvedGrupParalelId } : {}),
      ...(visibilityUpdate ? { visibility: visibilityUpdate } : {}),
    },
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "packages",
    entitasId: id,
    before,
    after: pkg,
    ip: getClientIp(request),
  });

  return NextResponse.json({ package: pkg });
}

/**
 * Tiket 2.9 (Bagian 7.2 brief): paket tidak boleh dihapus permanen, hanya
 * diarsipkan - dipakai status "archived" yang sudah ada di enum
 * PackageStatus, bukan kolom baru. Berlaku sama baik paket sudah punya
 * soal/attempt maupun masih kosong, supaya perilakunya konsisten &
 * riwayat tidak pernah hilang tanpa sengaja.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await assertOwnsPackage(user, id))) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  const before = await prisma.package.findUnique({ where: { id } });
  const pkg = await prisma.package.update({ where: { id }, data: { status: "archived" } });

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "packages",
    entitasId: id,
    before,
    after: pkg,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
