import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { createSnapTransaction } from "@/lib/billing/midtrans";
import { computeVoucherOrderAmount, VOUCHER_PRICE_TIERS } from "@/lib/billing/vouchers";
import { voucherOrderCheckoutSchema } from "@/lib/validations/partner";

/**
 * Jalur C lewat Midtrans (permintaan user): mitra beli batch voucher sendiri
 * dengan diskon grosir bertingkat (lihat VOUCHER_PRICE_TIERS di
 * lib/billing/vouchers.ts) - makin banyak dibeli sekaligus, makin murah per
 * voucher-nya, mirip pola tingkatan harga Jalur B. Begitu lunas, webhook
 * yang sama dengan Jalur A (app/api/webhooks/midtrans) yang generate N kode
 * vouchernya - bukan endpoint ini.
 */
export async function GET() {
  let user;
  try {
    user = await requireRole("mitra");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const partner = await prisma.partner.findUnique({ where: { userId: user.id } });
  if (!partner) {
    return NextResponse.json({ error: "Akun mitra belum terhubung." }, { status: 404 });
  }

  const [plans, pendingOrder] = await Promise.all([
    prisma.plan.findMany({ where: { kode: { in: ["monthly", "semester"] }, isActive: true }, orderBy: { harga: "asc" } }),
    prisma.voucherOrder.findFirst({
      where: { partnerId: partner.id, status: "pending", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    plans,
    pendingOrderId: pendingOrder?.id ?? null,
    tiers: VOUCHER_PRICE_TIERS,
  });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("mitra");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = voucherOrderCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const partner = await prisma.partner.findUnique({ where: { userId: user.id } });
  if (!partner) {
    return NextResponse.json({ error: "Akun mitra belum terhubung." }, { status: 404 });
  }

  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan || !plan.isActive || !["monthly", "semester"].includes(plan.kode)) {
    return NextResponse.json({ error: "Plan tidak ditemukan atau tidak aktif." }, { status: 404 });
  }

  const existingPending = await prisma.voucherOrder.findFirst({
    where: { partnerId: partner.id, status: "pending", expiresAt: { gt: new Date() } },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "Kamu masih punya pesanan voucher yang belum dibayar. Selesaikan atau tunggu kedaluwarsa dulu." },
      { status: 409 },
    );
  }

  const { amount, diskonPersen } = computeVoucherOrderAmount(plan.harga, parsed.data.jumlah);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const order = await prisma.voucherOrder.create({
    data: { partnerId: partner.id, planId: plan.id, jumlah: parsed.data.jumlah, amount, status: "pending", expiresAt },
  });

  let snap;
  try {
    snap = await createSnapTransaction({
      orderId: order.id,
      amount,
      customerName: partner.nama,
      customerEmail: user.email,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat transaksi pembayaran." },
      { status: 502 },
    );
  }

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "voucher_orders",
    entitasId: order.id,
    after: { ...order, diskonPersen },
    ip: getClientIp(request),
  });

  return NextResponse.json(
    { orderId: order.id, token: snap.token, redirectUrl: snap.redirectUrl },
    { status: 201 },
  );
}
