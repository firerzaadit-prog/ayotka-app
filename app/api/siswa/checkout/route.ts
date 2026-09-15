import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { createSnapTransaction } from "@/lib/billing/midtrans";
import { getActiveEntitlement } from "@/lib/billing/entitlements";
import { z } from "zod";

const REFERRAL_DISCOUNT = 0.3;
/**
 * Kasus tepi #4 (Bagian 9 dokumen rencana): dokumen sumber tidak memberi
 * angka pasti untuk "batas maksimum per bulan", cuma menyarankan untuk
 * dipertimbangkan - 10/bulan/referrer dipakai sebagai nilai kerja awal,
 * bisa diubah admin pusat kalau ada aturan bisnis lain.
 */
const MAX_REFERRAL_DISCOUNTS_PER_MONTH = 10;

const checkoutSchema = z.object({ planId: z.string().uuid() });

/** Status entitlement siswa + plan yang bisa dibeli - dipakai halaman Langganan. */
export async function GET() {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    include: { school: { select: { nama: true } } },
  });
  if (!student) {
    return NextResponse.json({ error: "Profil siswa tidak ditemukan." }, { status: 404 });
  }

  const [active, plans, pendingInvoice] = await Promise.all([
    getActiveEntitlement(student.id),
    prisma.plan.findMany({ where: { kode: { in: ["monthly", "semester"] }, isActive: true }, orderBy: { harga: "asc" } }),
    prisma.invoice.findFirst({
      where: { studentId: student.id, status: "pending", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    jalur: student.jalur,
    sekolah: student.school,
    referralCode: student.referralCode,
    entitlement: active
      ? {
          endsAt: active.entitlement.endsAt,
          canStartNewAttempt: active.canStartNewAttempt,
          canViewHistory: active.canViewHistory,
          source: active.entitlement.source,
        }
      : null,
    plans,
    pendingInvoiceId: pendingInvoice?.id ?? null,
  });
}

/**
 * Jalur A: buat invoice + transaksi Midtrans Snap. Diskon referral 30%
 * (Bagian 3 & 6.4) berlaku HANYA untuk transaksi pertama siswa yang
 * direferensikan - dicek dari ada/tidaknya invoice berstatus paid
 * sebelumnya, bukan dari kode referral itu sendiri (supaya tidak bisa
 * dipakai berulang oleh siswa yang sama).
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const student = await prisma.student.findFirst({ where: { userId: user.id } });
  if (!student) {
    return NextResponse.json({ error: "Profil siswa tidak ditemukan." }, { status: 404 });
  }

  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan || !plan.isActive || !["monthly", "semester"].includes(plan.kode)) {
    return NextResponse.json({ error: "Plan tidak ditemukan atau tidak aktif." }, { status: 404 });
  }

  const existingPending = await prisma.invoice.findFirst({
    where: { studentId: student.id, status: "pending", expiresAt: { gt: new Date() } },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "Kamu masih punya invoice yang belum dibayar. Selesaikan atau tunggu kedaluwarsa dulu." },
      { status: 409 },
    );
  }

  let amount = plan.harga;
  if (student.referredByStudentId) {
    const paidBefore = await prisma.invoice.count({ where: { studentId: student.id, status: "paid" } });
    if (paidBefore === 0) {
      const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
      const referralsThisMonth = await prisma.invoice.count({
        where: {
          createdAt: { gte: startOfMonth },
          student: { referredByStudentId: student.referredByStudentId },
        },
      });
      if (referralsThisMonth < MAX_REFERRAL_DISCOUNTS_PER_MONTH) {
        amount = Math.round(plan.harga * (1 - REFERRAL_DISCOUNT));
      }
    }
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const invoice = await prisma.invoice.create({
    data: { studentId: student.id, planId: plan.id, amount, status: "pending", expiresAt },
  });

  let snap;
  try {
    snap = await createSnapTransaction({
      orderId: invoice.id,
      amount,
      customerName: student.nama,
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
    entitas: "invoices",
    entitasId: invoice.id,
    after: invoice,
    ip: getClientIp(request),
  });

  return NextResponse.json(
    { invoiceId: invoice.id, token: snap.token, redirectUrl: snap.redirectUrl },
    { status: 201 },
  );
}
