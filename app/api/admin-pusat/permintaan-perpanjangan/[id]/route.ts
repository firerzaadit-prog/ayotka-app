import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { permintaanTolakSchema } from "@/lib/validations/school-periode";
import { PermintaanTidakValidError, tolakPermintaan } from "@/lib/billing/permintaan-perpanjangan";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Tolak permintaan perpanjangan (dengan alasan opsional yang dibaca admin sekolah). Menyetujui BUKAN lewat sini:
 * admin pusat membuat periode barunya (POST /api/admin-pusat/schools/[id]/periode dengan permintaanId) dan
 * permintaan ikut ditandai disetujui dalam transaksi yang sama.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = permintaanTolakSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, { status: 400 });
  }

  const { id } = await params;
  try {
    const permintaan = await tolakPermintaan(prisma, {
      permintaanId: id,
      adminId: user.id,
      catatanAdmin: parsed.data.catatanAdmin,
    });
    await logAudit({
      userId: user.id,
      aksi: "update",
      entitas: "school_renewal_requests",
      entitasId: id,
      after: { status: permintaan.status, catatanAdmin: permintaan.catatanAdmin },
      ip: getClientIp(request),
    });
    return NextResponse.json({ permintaan });
  } catch (error) {
    if (error instanceof PermintaanTidakValidError) {
      const tidakAda = /tidak ditemukan/.test(error.message);
      return NextResponse.json({ error: error.message }, { status: tidakAda ? 404 : 409 });
    }
    throw error;
  }
}
