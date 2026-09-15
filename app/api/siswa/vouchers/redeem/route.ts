import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { voucherRedeemSchema } from "@/lib/validations/partner";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Jalur C (Bagian 5 & 6.5 dokumen rencana): siswa mandiri menukar kode
 * voucher dari mitra langsung jadi entitlement - TIDAK PERNAH membuat
 * invoice (beda dari Jalur A/Midtrans di app/api/siswa/checkout).
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = voucherRedeemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const student = await prisma.student.findFirst({ where: { userId: user.id } });
  if (!student) {
    return NextResponse.json({ error: "Profil siswa tidak ditemukan." }, { status: 404 });
  }

  const code = parsed.data.code.trim().toUpperCase();
  const voucher = await prisma.voucher.findUnique({ where: { code }, include: { plan: true } });
  if (!voucher) {
    return NextResponse.json({ error: "Kode voucher tidak ditemukan." }, { status: 404 });
  }
  if (voucher.status !== "unused") {
    return NextResponse.json(
      { error: voucher.status === "used" ? "Kode voucher ini sudah dipakai." : "Kode voucher ini sudah tidak berlaku." },
      { status: 409 },
    );
  }

  const startsAt = new Date();
  const endsAt = voucher.plan.durasiHari ? addDays(startsAt, voucher.plan.durasiHari) : addDays(startsAt, 30);

  const entitlement = await prisma.$transaction(async (tx) => {
    const updated = await tx.voucher.updateMany({
      where: { id: voucher.id, status: "unused" },
      data: { status: "used", usedByStudentId: student.id, usedAt: new Date() },
    });
    if (updated.count === 0) {
      throw new Error("VOUCHER_ALREADY_USED");
    }

    return tx.entitlement.create({
      data: {
        studentId: student.id,
        planId: voucher.planId,
        startsAt,
        endsAt,
        source: "voucher",
        voucherId: voucher.id,
      },
    });
  }).catch((error) => {
    if (error instanceof Error && error.message === "VOUCHER_ALREADY_USED") return null;
    throw error;
  });

  if (!entitlement) {
    return NextResponse.json({ error: "Kode voucher ini sudah dipakai." }, { status: 409 });
  }

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "vouchers",
    entitasId: voucher.id,
    after: { status: "used", studentId: student.id },
    ip: getClientIp(request),
  });

  return NextResponse.json({ entitlement }, { status: 201 });
}
