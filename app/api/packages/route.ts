import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { getOwnerScope, assertGrupParalelOwnedBySelf } from "@/lib/packages/scope";
import { packageCreateSchema } from "@/lib/validations/question";

export async function GET() {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const scope = await getOwnerScope(user);
  if (!scope) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const packages = await prisma.package.findMany({
    where: { ownerType: scope.ownerType, ownerId: scope.ownerId, status: { not: "archived" } },
    orderBy: { nama: "asc" },
    include: { subject: true, _count: { select: { questions: { where: { deletedAt: null } } } } },
  });

  return NextResponse.json({ packages });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const scope = await getOwnerScope(user);
  if (!scope) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = packageCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { blueprintId, grupParalelId, visibilityMode, visibilitySchoolIds, ...rest } = parsed.data;

  // Distribusi lintas sekolah (visibility) cuma konsep milik paket pusat
  // (Tiket 2.8) - paket sekolah tidak punya ini, field ini diabaikan diam-diam
  // kalau tetap dikirim admin_sekolah (lihat visibility/route.ts assertOwnedByPusat).
  let visibilityCreate: Prisma.PackageCreateInput["visibility"] = undefined;
  if (scope.ownerType === "pusat" && visibilityMode && visibilityMode !== "privat") {
    if (visibilityMode === "sekolah" && visibilitySchoolIds) {
      visibilityCreate = {
        create: visibilitySchoolIds.map((id: string) => ({ targetType: "sekolah" as const, schoolId: id })),
      };
    } else {
      visibilityCreate = { create: [{ targetType: visibilityMode }] };
    }
  }

  const resolvedGrupParalelId = grupParalelId && grupParalelId.length > 0 ? grupParalelId : null;
  if (resolvedGrupParalelId && !(await assertGrupParalelOwnedBySelf(scope, resolvedGrupParalelId))) {
    return NextResponse.json(
      { error: "Grup paralel ini milik pihak lain, tidak bisa digabungkan." },
      { status: 403 },
    );
  }

  const pkg = await prisma.package.create({
    data: {
      ...rest,
      ...scope,
      blueprintId: blueprintId && blueprintId.length > 0 ? blueprintId : null,
      grupParalelId: resolvedGrupParalelId,
      ...(visibilityCreate ? { visibility: visibilityCreate } : {}),
    },
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "packages",
    entitasId: pkg.id,
    after: pkg,
    ip: getClientIp(request),
  });

  return NextResponse.json({ package: pkg }, { status: 201 });
}
