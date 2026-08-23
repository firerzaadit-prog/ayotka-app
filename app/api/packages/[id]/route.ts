import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { assertOwnsPackage } from "@/lib/packages/scope";
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
      blueprint: { include: { items: { include: { kompetensi: true } } } },
      questions: {
        where: { deletedAt: null },
        orderBy: { id: "asc" },
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
  const { blueprintId, grupParalelId, ...rest } = parsed.data;

  const pkg = await prisma.package.update({
    where: { id },
    data: {
      ...rest,
      ...(blueprintId !== undefined
        ? { blueprintId: blueprintId.length > 0 ? blueprintId : null }
        : {}),
      ...(grupParalelId !== undefined
        ? { grupParalelId: grupParalelId.length > 0 ? grupParalelId : null }
        : {}),
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
