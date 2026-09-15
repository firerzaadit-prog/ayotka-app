import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { partnerCommissionCreateSchema } from "@/lib/validations/partner";

/** GET: daftar semua komisi mitra lintas partner, untuk halaman Mitra & Voucher admin pusat. */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const commissions = await prisma.partnerCommission.findMany({
    include: {
      partner: { select: { id: true, nama: true } },
      school: { select: { id: true, nama: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ commissions });
}

/**
 * Bagian 9 kasus tepi #7: klaim rujukan sekolah yang telat dicatat - SELALU
 * dibuat manual di sini, TIDAK PERNAH otomatis. Tidak mengubah
 * School.referredByPartnerId (itu cuma boleh diisi saat aktivasi kursi
 * pertama, lihat app/api/admin-pusat/schools/[id]/seat) - murni catatan
 * komisi berdasarkan verifikasi terpisah admin di luar sistem.
 */
export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = partnerCommissionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { partnerId, schoolId, note } = parsed.data;
  const [partner, school] = await Promise.all([
    prisma.partner.findUnique({ where: { id: partnerId } }),
    prisma.school.findUnique({ where: { id: schoolId } }),
  ]);
  if (!partner) {
    return NextResponse.json({ error: "Mitra tidak ditemukan." }, { status: 404 });
  }
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  const commission = await prisma.partnerCommission.create({
    data: { partnerId, schoolId, status: "pending", note },
  });

  await logAudit({
    userId: actor.id,
    aksi: "create",
    entitas: "partner_commissions",
    entitasId: commission.id,
    after: commission,
    ip: getClientIp(request),
  });

  return NextResponse.json({ commission }, { status: 201 });
}
