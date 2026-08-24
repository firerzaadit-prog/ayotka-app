import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { planUpdateSchema } from "@/lib/validations/plan";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.plan.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Paket langganan tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = planUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { kuota, ...rest } = parsed.data;
  const plan = await prisma.plan.update({
    where: { id },
    data: { ...rest, ...(kuota !== undefined ? { kuota: kuota === "" ? null : kuota } : {}) },
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "plans",
    entitasId: id,
    before,
    after: plan,
    ip: getClientIp(request),
  });

  return NextResponse.json({ plan });
}

/** Bagian 5 brief (jangan cascade hapus riwayat transaksi): orders/subscriptions/schools memakai onDelete Restrict ke plan. */
export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.plan.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Paket langganan tidak ditemukan." }, { status: 404 });
  }

  try {
    await prisma.plan.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Paket ini masih dipakai sekolah atau ada riwayat pesanan/langganan, sehingga tidak bisa dihapus permanen.",
        },
        { status: 409 },
      );
    }
    throw error;
  }

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "plans",
    entitasId: id,
    before,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
