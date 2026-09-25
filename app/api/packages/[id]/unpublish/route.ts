import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { assertOwnsPackage } from "@/lib/packages/scope";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Sembunyikan paket yang sudah dipublish (kembali ke draft) supaya admin bisa
 * mengedit soal/pengaturannya dengan tenang, lalu Publish lagi setelah selesai
 * (lihat ../publish/route.ts). Yang terjadi selama draft: paket hilang dari
 * menu Try Out Mandiri/Nasional siswa (semua daftar self-select menyaring
 * status "published"), tapi attempt yang SEDANG berjalan tetap bisa
 * dilanjutkan lewat halaman attempt-nya sendiri, dan riwayat/hasil siswa
 * tidak tersentuh sama sekali.
 */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await assertOwnsPackage(user, id))) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  const before = await prisma.package.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }
  if (before.status !== "published") {
    return NextResponse.json({ error: "Paket ini tidak sedang dipublish." }, { status: 409 });
  }

  const updated = await prisma.package.update({ where: { id }, data: { status: "draft" } });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "packages",
    entitasId: id,
    before,
    after: updated,
    ip: getClientIp(request),
  });

  return NextResponse.json({ package: updated });
}
