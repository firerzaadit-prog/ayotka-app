import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { schoolPendingActionSchema } from "@/lib/validations/school";

type RouteParams = { params: Promise<{ id: string }> };

function isPendingPlaceholder(school: { status: string; kuotaSiswa: number }): boolean {
  return school.status === "pending_verifikasi" && school.kuotaSiswa === 0;
}

/**
 * Tiket 7.4: tiga aksi atas satu baris antrean.
 * - approve: sekolah ini memang entitas baru yang sah - lengkapi datanya
 *   (kuota wajib diisi, kode_sekolah yang sudah ada dari registrasi
 *   dipertahankan) lalu aktifkan.
 * - reject: bukan sekolah yang perlu dicatat terpisah (typo tak jelas,
 *   entri iseng, dst) - lepas siswanya (school_id jadi null, TIDAK
 *   menghapus akun/status siswa - langganan mandiri mereka berdiri
 *   sendiri, lihat lib/billing) lalu hapus baris placeholder-nya.
 * - merge: siswa salah ketik/pakai variasi nama sekolah yang SUDAH ada di
 *   data resmi - pindahkan semua siswa ke sekolah tujuan, hapus placeholder.
 */
export async function POST(request: Request, { params }: RouteParams) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const school = await prisma.school.findUnique({ where: { id } });
  if (!school || !isPendingPlaceholder(school)) {
    return NextResponse.json(
      { error: "Sekolah pending tidak ditemukan atau sudah diproses." },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schoolPendingActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const ip = getClientIp(request);

  if (data.action === "approve") {
    const updated = await prisma.school.update({
      where: { id },
      data: {
        nama: data.nama,
        npsn: data.npsn && data.npsn.length > 0 ? data.npsn : null,
        alamat: data.alamat && data.alamat.length > 0 ? data.alamat : null,
        kuotaSiswa: data.kuotaSiswa,
        status: "aktif",
      },
    });
    await logAudit({
      userId: actor.id,
      aksi: "update",
      entitas: "schools",
      entitasId: id,
      before: school,
      after: updated,
      ip,
    });
    return NextResponse.json({ ok: true, school: updated });
  }

  if (data.action === "reject") {
    await prisma.$transaction([
      prisma.student.updateMany({ where: { schoolId: id }, data: { schoolId: null } }),
      prisma.school.delete({ where: { id } }),
    ]);
    await logAudit({
      userId: actor.id,
      aksi: "delete",
      entitas: "schools",
      entitasId: id,
      before: school,
      ip,
    });
    return NextResponse.json({ ok: true });
  }

  // action === "merge"
  if (data.targetSchoolId === id) {
    return NextResponse.json({ error: "Tidak bisa merge ke sekolah itu sendiri." }, { status: 400 });
  }
  const target = await prisma.school.findUnique({ where: { id: data.targetSchoolId } });
  if (!target) {
    return NextResponse.json({ error: "Sekolah tujuan tidak ditemukan." }, { status: 404 });
  }
  if (isPendingPlaceholder(target)) {
    return NextResponse.json(
      { error: "Sekolah tujuan masih berupa antrean pending juga - pilih sekolah resmi." },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.student.updateMany({ where: { schoolId: id }, data: { schoolId: data.targetSchoolId } }),
    prisma.school.delete({ where: { id } }),
  ]);
  await logAudit({
    userId: actor.id,
    aksi: "update",
    entitas: "schools",
    entitasId: data.targetSchoolId,
    before: { mergedFrom: school },
    after: { mergedFromId: id, mergedFromNama: school.nama },
    ip,
  });

  return NextResponse.json({ ok: true });
}
