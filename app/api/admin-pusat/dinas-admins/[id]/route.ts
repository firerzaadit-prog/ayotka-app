import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { dinasAdminUpdateSchema } from "@/lib/validations/dinas-pendidikan";
import { wilayahSetelahPerubahan } from "@/lib/wilayah";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Ubah profil (nama/instansi/wilayah provinsi atau kota/kabupaten) atau nonaktifkan/aktifkan akun dinas
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

  const { status, nama, instansi, provinsi, kabupatenKota } = parsed.data;

  // Wilayah dihitung dari isian + wilayah sebelumnya (provinsi diturunkan dari kota/kabupaten bila hanya itu yang
  // dikirim; mengganti provinsi tanpa memilih ulang kota/kabupaten ditolak bila kota/kabupaten lama bukan bagiannya).
  // Akun dinas tidak boleh berakhir tanpa wilayah sama sekali: akunnya akan ditolak di semua halaman dinas.
  const wilayahBerubah = provinsi !== undefined || kabupatenKota !== undefined;
  const sebelumnya = {
    provinsi: beforeUser.dinasProfile?.provinsi ?? null,
    kabupatenKota: beforeUser.dinasProfile?.kabupatenKota ?? null,
  };
  const wilayah = wilayahSetelahPerubahan({ provinsi, kabupatenKota }, sebelumnya);
  if (!wilayah.ok) {
    return NextResponse.json({ error: wilayah.pesan }, { status: 400 });
  }
  if (wilayahBerubah && !wilayah.nilai.provinsi && !wilayah.nilai.kabupatenKota) {
    return NextResponse.json({ error: "Pilih provinsi wilayah cakupan; akun dinas tidak boleh tanpa wilayah." }, { status: 400 });
  }

  const profileData = {
    ...(nama !== undefined ? { nama } : {}),
    ...(instansi !== undefined ? { instansi } : {}),
    ...(wilayahBerubah ? { provinsi: wilayah.nilai.provinsi, kabupatenKota: wilayah.nilai.kabupatenKota } : {}),
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
              provinsi: wilayah.nilai.provinsi,
              kabupatenKota: wilayah.nilai.kabupatenKota,
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
