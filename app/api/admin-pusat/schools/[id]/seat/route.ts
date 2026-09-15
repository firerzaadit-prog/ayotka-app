import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { schoolSeatActivateSchema } from "@/lib/validations/school-seat";

type RouteParams = { params: Promise<{ id: string }> };

/** GET: status kursi sekolah saat ini + jumlah kursi terpakai (live count, bukan counter). */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId } = await params;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: { referredByPartner: { select: { id: true, nama: true } } },
  });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  const seatsUsed = await prisma.entitlement.count({
    where: { schoolId, source: "school_seat", revokedAt: null },
  });
  const partners = await prisma.partner.findMany({ orderBy: { nama: "asc" } });

  return NextResponse.json({
    seatQuota: school.seatQuota,
    validUntil: school.validUntil,
    seatsUsed,
    referredByPartner: school.referredByPartner,
    /** true kalau belum pernah diaktifkan - referredByPartnerId cuma boleh diisi sekarang (Bagian 4.1). */
    isFirstActivation: school.seatQuota == null,
    partners,
  });
}

/**
 * Aktivasi/ubah kuota kursi. Bagian 4.1: rujukan mitra WAJIB dicatat SEBELUM
 * kuota diaktifkan pertama kali - kalau sekolah sudah pernah diaktifkan
 * sebelumnya, referredByPartnerId tidak boleh diisi lewat endpoint ini lagi
 * (Bagian 6.7: klaim rujukan telat wajib lewat verifikasi manual terpisah,
 * tidak retroaktif otomatis).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId } = await params;
  const before = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!before) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schoolSeatActivateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const isFirstActivation = before.seatQuota == null;
  if (parsed.data.referredByPartnerId && !isFirstActivation) {
    return NextResponse.json(
      {
        error:
          "Sekolah ini sudah pernah diaktifkan sebelumnya. Rujukan mitra yang telat dicatat tidak bisa " +
          "otomatis - catat komisi secara manual dengan verifikasi terpisah, bukan lewat aktivasi ulang ini.",
      },
      { status: 409 },
    );
  }

  const school = await prisma.$transaction(async (tx) => {
    const updated = await tx.school.update({
      where: { id: schoolId },
      data: {
        seatQuota: parsed.data.seatQuota,
        validUntil: parsed.data.validUntil,
        seatActivatedById: user.id,
        ...(isFirstActivation ? { referredByPartnerId: parsed.data.referredByPartnerId ?? null } : {}),
      },
    });

    if (isFirstActivation && parsed.data.referredByPartnerId) {
      await tx.partnerCommission.create({
        data: {
          partnerId: parsed.data.referredByPartnerId,
          schoolId,
          status: "pending",
        },
      });
    }

    return updated;
  });

  await logAudit({
    userId: user.id,
    aksi: isFirstActivation ? "create" : "update",
    entitas: "schools_seat",
    entitasId: schoolId,
    before,
    after: school,
    ip: getClientIp(request),
  });

  return NextResponse.json({ school });
}
