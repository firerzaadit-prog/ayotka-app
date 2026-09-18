import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { voucherPriceTierUpdateSchema } from "@/lib/validations/voucher-price-tier";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = voucherPriceTierUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }

  const before = await prisma.voucherPriceTier.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Tingkatan diskon tidak ditemukan." }, { status: 404 });
  }

  let updated;
  try {
    updated = await prisma.voucherPriceTier.update({
      where: { id },
      data: parsed.data,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Sudah ada tingkatan dengan jumlah minimal yang sama." }, { status: 409 });
    }
    throw error;
  }

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "voucher_price_tiers",
    entitasId: id,
    before,
    after: updated,
    ip: getClientIp(request),
  });

  return NextResponse.json({ tier: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.voucherPriceTier.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Tingkatan diskon tidak ditemukan." }, { status: 404 });
  }

  await prisma.voucherPriceTier.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "voucher_price_tiers",
    entitasId: id,
    before,
    ip: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}
