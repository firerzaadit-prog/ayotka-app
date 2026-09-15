import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { planCreateSchema } from "@/lib/validations/plan";

/**
 * Jalur A (siswa individu): admin pusat mengatur harga & durasi plan
 * monthly/semester yang ditawarkan lewat Midtrans. Plan free/school dibuat
 * otomatis oleh sistem (lihat lib/billing/entitlements.ts), tidak lewat sini.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const plans = await prisma.plan.findMany({
    where: { kode: { in: ["monthly", "semester"] } },
    orderBy: { harga: "asc" },
  });
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

  const plan = await prisma.plan.create({
    data: { ...parsed.data, isActive: parsed.data.isActive ?? true },
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
