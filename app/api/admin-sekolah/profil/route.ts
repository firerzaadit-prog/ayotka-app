import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { profilSekolahUpdateSchema } from "@/lib/validations/school";
import { statusSekolahUntukSimpan, wilayahSetelahPerubahan } from "@/lib/wilayah";

const PILIH_PROFIL = {
  id: true,
  nama: true,
  npsn: true,
  jenjang: true,
  alamat: true,
  provinsi: true,
  kabupatenKota: true,
  statusSekolah: true,
} as const;

/**
 * Profil sekolah untuk admin sekolah: data identitas (nama, NPSN, jenjang - hanya dibaca) dan data yang boleh
 * dilengkapi sendiri (alamat, provinsi, kota/kabupaten, status negeri/swasta). Data wilayah dan status dipakai untuk
 * memetakan nilai sekolah per wilayah dan jenis sekolah (laporan dan analitik).
 */
export async function GET() {
  let user;
  try {
    user = await requireRole("admin_sekolah", "admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: PILIH_PROFIL });
  if (!school) return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ school });
}

export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireRole("admin_sekolah", "admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profilSekolahUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, { status: 400 });
  }

  const before = await prisma.school.findUnique({ where: { id: schoolId }, select: PILIH_PROFIL });
  if (!before) return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });

  const { alamat, provinsi, kabupatenKota, statusSekolah } = parsed.data;
  const wilayah = wilayahSetelahPerubahan(
    { provinsi, kabupatenKota },
    { provinsi: before.provinsi, kabupatenKota: before.kabupatenKota },
  );
  if (!wilayah.ok) return NextResponse.json({ error: wilayah.pesan }, { status: 400 });
  const wilayahBerubah = provinsi !== undefined || kabupatenKota !== undefined;

  const school = await prisma.school.update({
    where: { id: schoolId },
    data: {
      ...(alamat !== undefined ? { alamat: alamat.length > 0 ? alamat : null } : {}),
      ...(wilayahBerubah ? { provinsi: wilayah.nilai.provinsi, kabupatenKota: wilayah.nilai.kabupatenKota } : {}),
      ...(statusSekolah !== undefined ? { statusSekolah: statusSekolahUntukSimpan(statusSekolah) } : {}),
    },
    select: PILIH_PROFIL,
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "schools",
    entitasId: schoolId,
    before,
    after: school,
    ip: getClientIp(request),
  });

  return NextResponse.json({ school });
}
