import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { generateReadableCode } from "@/lib/utils/generate-code";
import { voucherGenerateSchema } from "@/lib/validations/partner";

/** GET: daftar voucher, opsional difilter per mitra (?partnerId=). */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const partnerId = new URL(request.url).searchParams.get("partnerId");
  const vouchers = await prisma.voucher.findMany({
    where: partnerId ? { partnerId } : undefined,
    include: { plan: { select: { nama: true } }, partner: { select: { nama: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ vouchers });
}

async function generateUniqueVoucherCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReadableCode(10);
    const existing = await prisma.voucher.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Gagal membuat kode voucher unik, coba lagi.");
}

/**
 * Jalur C (Bagian 5 dokumen rencana): admin pusat generate N kode voucher
 * sekaligus untuk satu mitra + satu plan. Mitra membeli batch ini di luar
 * sistem inti (transfer manual dsb, di luar cakupan Paket 1) - endpoint ini
 * cuma mencatat kodenya, tidak membuat invoice.
 */
export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = voucherGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { partnerId, planId, jumlah } = parsed.data;

  const [partner, plan] = await Promise.all([
    prisma.partner.findUnique({ where: { id: partnerId } }),
    prisma.plan.findUnique({ where: { id: planId } }),
  ]);
  if (!partner) {
    return NextResponse.json({ error: "Mitra tidak ditemukan." }, { status: 404 });
  }
  if (!plan || !plan.isActive) {
    return NextResponse.json({ error: "Plan tidak ditemukan atau tidak aktif." }, { status: 404 });
  }

  const codes: string[] = [];
  for (let i = 0; i < jumlah; i++) {
    codes.push(await generateUniqueVoucherCode());
  }

  const vouchers = await prisma.$transaction(
    codes.map((code) =>
      prisma.voucher.create({
        data: { code, planId, partnerId, generatedById: actor.id },
      }),
    ),
  );

  await logAudit({
    userId: actor.id,
    aksi: "create",
    entitas: "vouchers",
    entitasId: partnerId,
    after: { partnerId, planId, jumlah, codes },
    ip: getClientIp(request),
  });

  return NextResponse.json({ vouchers }, { status: 201 });
}
