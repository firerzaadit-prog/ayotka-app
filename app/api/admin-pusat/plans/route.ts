import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { planCreateSchema } from "@/lib/validations/plan";

/**
 * Paket langganan (target sekolah atau siswa mandiri) - data dasar yang
 * dibutuhkan seluruh alur Fase 6 (checkout, approval, langganan sekolah).
 * Tidak ada tiket eksplisit untuk CRUD ini di panduan teknis, tapi tanpa
 * ini tiket 6.3/6.4/6.8 tidak punya data untuk dipakai sama sekali.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const plans = await prisma.plan.findMany({ orderBy: [{ target: "asc" }, { harga: "asc" }] });
  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = planCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { kuota, ...rest } = parsed.data;
  const plan = await prisma.plan.create({
    data: { ...rest, kuota: kuota === "" || kuota === undefined ? null : kuota },
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "plans",
    entitasId: plan.id,
    after: plan,
    ip: getClientIp(request),
  });

  return NextResponse.json({ plan }, { status: 201 });
}
