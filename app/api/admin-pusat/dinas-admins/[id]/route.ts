import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { dinasAdminUpdateSchema } from "@/lib/validations/dinas-pendidikan";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Ubah profil (nama/instansi/wilayah) atau nonaktifkan/aktifkan akun dinas
 * pendidikan - dipakai saat wilayah cakupannya perlu dikoreksi, atau kalau
 * akun perlu dinonaktifkan tanpa dihapus (pola sama seperti admin sekolah,
 * lihat app/api/admin-pusat/school-admins/[id]).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = dinasAdminUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const beforeUser = await prisma.user.findUnique({ where: { id }, include: { dinasProfile: true } });
  if (!beforeUser || beforeUser.role !== "dinas_pendidikan") {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  const { status, nama, instansi, kabupatenKota } = parsed.data;
  const profileData = {
    ...(nama !== undefined ? { nama } : {}),
    ...(instansi !== undefined ? { instansi } : {}),
    ...(kabupatenKota !== undefined ? { kabupatenKota } : {}),
  };

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: status !== undefined ? { status } : {},
    }),
    // Profil bisa saja belum ada (akun lama sebelum kolom wilayah dibuat) -
    // upsert supaya tetap bisa dilengkapi lewat form edit yang sama.
    ...(Object.keys(profileData).length > 0
      ? [
          prisma.dinasAdmin.upsert({
            where: { userId: id },
            update: profileData,
            create: {
              userId: id,
              nama: nama ?? beforeUser.dinasProfile?.nama ?? "",
              instansi: instansi ?? beforeUser.dinasProfile?.instansi ?? "",
              kabupatenKota: kabupatenKota ?? beforeUser.dinasProfile?.kabupatenKota ?? "",
            },
          }),
        ]
      : []),
  ]);

  await logAudit({
    userId: actor.id,
    aksi: "update",
    entitas: "users",
    entitasId: id,
    before: { status: beforeUser.status, ...beforeUser.dinasProfile },
    after: { status: user.status, ...profileData },
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
