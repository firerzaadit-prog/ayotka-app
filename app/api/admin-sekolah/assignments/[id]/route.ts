import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { assignmentUpdateSchema } from "@/lib/validations/assignment";
import { periksaJadwalPenugasan } from "@/lib/exam/jadwal-penugasan";
import { PESAN_NASIONAL_ADMIN_PUSAT } from "@/lib/exam/paket-tersedia";
import { statusPenugasan } from "@/lib/exam/status-penugasan";
import { ambilPeriodeSekolah } from "@/lib/billing/periode-sekolah";

type RouteParams = { params: Promise<{ id: string }> };

async function loadOwned(schoolId: string, id: string) {
  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (!assignment || assignment.schoolId !== schoolId) return null;
  return assignment;
}

export async function PATCH(request: Request, { params }: RouteParams) {
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

  const { id } = await params;
  const before = await loadOwned(schoolId, id);
  if (!before) {
    return NextResponse.json({ error: "Penugasan tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = assignmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  // Urutan waktu dicek dari nilai AKHIR (lama + yang diubah): mengubah salah
  // satunya saja juga bisa membuat selesai jatuh sebelum mulai. Skema update
  // tidak bisa mengecek ini karena kedua field opsional.
  const mulai = parsed.data.mulai ?? before.mulai;
  const selesai = parsed.data.selesai ?? before.selesai;
  if (selesai <= mulai) {
    return NextResponse.json({ error: "Waktu selesai harus setelah waktu mulai." }, { status: 400 });
  }

  // Jadwal yang DITULIS (bukan sekadar mengaktifkan/menonaktifkan) harus di masa depan dan di dalam masa langganan
  // sekolah, sama dengan saat membuat. Memperpanjang jendela yang sudah tutup juga lewat sini ("buka lagi").
  if (parsed.data.mulai !== undefined || parsed.data.selesai !== undefined) {
    // Try Out Nasional hanya dijalankan admin pusat: admin sekolah tidak boleh mengubah jadwal penugasan nasional
    // (menonaktifkan atau menghapusnya tetap boleh, supaya sekolah bisa membereskan penugasan lama).
    if (user.role !== "admin_pusat") {
      const paket = await prisma.package.findUnique({ where: { id: before.packageId }, select: { kategori: true } });
      if (paket?.kategori === "nasional") {
        return NextResponse.json({ error: PESAN_NASIONAL_ADMIN_PUSAT, code: "NASIONAL_ADMIN_PUSAT" }, { status: 403 });
      }
    }
    const jadwal = periksaJadwalPenugasan({
      mulai,
      selesai,
      sekarang: new Date(),
      periode: await ambilPeriodeSekolah(prisma, schoolId),
    });
    if (!jadwal.ok) {
      return NextResponse.json({ error: jadwal.error, code: jadwal.code }, { status: jadwal.status });
    }
  }

  const assignment = await prisma.assignment.update({ where: { id }, data: parsed.data });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "assignments",
    entitasId: id,
    before,
    after: assignment,
    ip: getClientIp(request),
  });

  return NextResponse.json({ assignment });
}

/**
 * Hapus penugasan yang belum dipakai siapa pun. Penugasan yang sudah pernah dikerjakan TIDAK boleh dihapus: relasi
 * percobaan -> penugasan bersifat SetNull, jadi percobaan siswa akan "pindah" menjadi percobaan latihan mandiri
 * (mengacaukan nomor percobaan, seri paket, dan kuota). Untuk itu cukup dinonaktifkan. Yang sedang berlangsung
 * (aktif dan jendelanya terbuka) juga harus dinonaktifkan dulu, supaya tidak ada siswa yang memulai tepat saat
 * penugasannya dihapus.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
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

  const { id } = await params;
  const before = await loadOwned(schoolId, id);
  if (!before) {
    return NextResponse.json({ error: "Penugasan tidak ditemukan." }, { status: 404 });
  }

  if (statusPenugasan(before) === "berlangsung") {
    return NextResponse.json(
      { error: "Penugasan ini sedang berlangsung. Nonaktifkan dulu, baru bisa dihapus.", code: "MASIH_BERLANGSUNG" },
      { status: 409 },
    );
  }

  const hasil = await prisma.$transaction(async (tx) => {
    const jumlah = await tx.attempt.count({ where: { assignmentId: id } });
    if (jumlah > 0) return { jumlah };
    await tx.assignment.delete({ where: { id } });
    return { jumlah: 0 };
  });
  if (hasil.jumlah > 0) {
    return NextResponse.json(
      {
        error: `Penugasan ini sudah dikerjakan ${hasil.jumlah} kali, jadi tidak bisa dihapus agar nilai siswa tetap utuh. Nonaktifkan saja supaya siswa tidak bisa memulai lagi.`,
        code: "SUDAH_DIKERJAKAN",
      },
      { status: 409 },
    );
  }

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "assignments",
    entitasId: id,
    before,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
