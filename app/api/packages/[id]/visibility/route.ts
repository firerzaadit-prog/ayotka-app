import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { visibilityUpdateSchema } from "@/lib/validations/visibility";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Tiket 2.8: distribusi paket pusat -> sekolah. Hanya admin pusat, hanya
 * untuk paket miliknya sendiri (owner_type=pusat) - paket sekolah tidak
 * punya konsep distribusi lintas sekolah.
 */
async function assertOwnedByPusat(packageId: string) {
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  return pkg?.ownerType === "pusat" ? pkg : null;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await assertOwnedByPusat(id))) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  const visibility = await prisma.packageVisibility.findMany({
    where: { packageId: id },
    include: { school: { select: { id: true, nama: true } } },
  });

  return NextResponse.json({ visibility });
}

export async function PUT(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: packageId } = await params;
  if (!(await assertOwnedByPusat(packageId))) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = visibilityUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const before = await prisma.packageVisibility.findMany({ where: { packageId } });

  const visibility = await prisma.$transaction(async (tx) => {
    await tx.packageVisibility.deleteMany({ where: { packageId } });

    if (parsed.data.mode === "privat") {
      return [];
    }
    if (parsed.data.mode === "semua") {
      return [await tx.packageVisibility.create({ data: { packageId, targetType: "semua" } })];
    }
    if (parsed.data.mode === "publik") {
      return [await tx.packageVisibility.create({ data: { packageId, targetType: "publik" } })];
    }
    return Promise.all(
      parsed.data.schoolIds.map((schoolId) =>
        tx.packageVisibility.create({ data: { packageId, targetType: "sekolah", schoolId } }),
      ),
    );
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "package_visibility",
    entitasId: packageId,
    before,
    after: visibility,
    ip: getClientIp(request),
  });

  return NextResponse.json({ visibility });
}
