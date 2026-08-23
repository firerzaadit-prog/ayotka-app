import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";

type RouteParams = { params: Promise<{ id: string }> };

const patchSchema = z.object({ status: z.enum(["aktif", "nonaktif"]) });

/** Nonaktifkan/aktifkan kembali akun admin sekolah (Bagian 5 brief, poin 2). */
export async function PATCH(request: Request, { params }: RouteParams) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const before = await prisma.user.findUnique({ where: { id } });
  if (!before || before.role !== "admin_sekolah") {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  await logAudit({
    userId: actor.id,
    aksi: "update",
    entitas: "users",
    entitasId: id,
    before,
    after: user,
    ip: getClientIp(request),
  });

  return NextResponse.json({ user });
}
