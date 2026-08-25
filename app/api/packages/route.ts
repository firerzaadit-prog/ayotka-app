import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { getOwnerScope } from "@/lib/packages/scope";
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

  const { blueprintId, grupParalelId, ...rest } = parsed.data;

  const pkg = await prisma.package.create({
    data: {
      ...rest,
      ...scope,
      blueprintId: blueprintId && blueprintId.length > 0 ? blueprintId : null,
      grupParalelId: grupParalelId && grupParalelId.length > 0 ? grupParalelId : null,
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
