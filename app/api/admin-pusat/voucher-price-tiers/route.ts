import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { voucherPriceTierCreateSchema } from "@/lib/validations/voucher-price-tier";

/**
 * Bagian A (permintaan user): skema diskon grosir mitra beli voucher, dulu
 * hardcoded di kode - sekarang admin pusat bisa atur tingkatannya kapan
 * saja lewat halaman Mitra & Voucher, tanpa deploy ulang.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const tiers = await prisma.voucherPriceTier.findMany({ orderBy: { minJumlah: "asc" } });
  return NextResponse.json({ tiers });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = voucherPriceTierCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  let tier;
  try {
    tier = await prisma.voucherPriceTier.create({ data: parsed.data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Sudah ada tingkatan dengan jumlah minimal yang sama." }, { status: 409 });
    }
    throw error;
  }

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "voucher_price_tiers",
    entitasId: tier.id,
    after: tier,
    ip: getClientIp(request),
  });

  return NextResponse.json({ tier }, { status: 201 });
}
