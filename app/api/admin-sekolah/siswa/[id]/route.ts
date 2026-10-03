import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buatPenghapusAkunLogin,
  GagalHapusAkunLoginError,
  hapusSiswa,
  ringkasanAuditHapus,
} from "@/lib/students/hapus";
import { studentUpdateSchema } from "@/lib/validations/student";

type RouteParams = { params: Promise<{ id: string }> };

async function loadOwnedStudent(user: Awaited<ReturnType<typeof requireRole>>, id: string) {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student || student.deletedAt || !student.schoolId) return null;
  const allowedSchoolId = await resolveSchoolId(user, student.schoolId);
  if (allowedSchoolId !== student.schoolId) return null;
  return student;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await loadOwnedStudent(user, id);
  if (!before) {
    return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = studentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { nisn, ...rest } = parsed.data;

  try {
    const student = await prisma.student.update({
      where: { id },
      data: { ...rest, ...(nisn !== undefined ? { nisn: nisn.length > 0 ? nisn : null } : {}) },
    });

    await logAudit({
      userId: user.id,
      aksi: "update",
      entitas: "students",
      entitasId: id,
      before,
      after: student,
      ip: getClientIp(request),
    });

    return NextResponse.json({ student });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "NISN sudah dipakai siswa lain." }, { status: 409 });
    }
    throw error;
  }
}

/**
 * Hapus siswa (lihat lib/students/hapus.ts): akun login dihapus; siswa tanpa riwayat dihapus permanen,
 * siswa yang sudah punya riwayat ujian/transaksi diarsipkan (Bagian 7.2 brief) tetapi NISN dan kode
 * klaimnya dibebaskan - sehingga data yang sama bisa ditambahkan/diimpor lagi.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await loadOwnedStudent(user, id);
  if (!before) {
    return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  }

  let mode: "permanen" | "arsip";
  try {
    mode = await hapusSiswa({ db: prisma, hapusAkunLogin: buatPenghapusAkunLogin(createAdminClient()) }, before);
  } catch (error) {
    if (error instanceof GagalHapusAkunLoginError) {
      // Belum ada data yang berubah - aman diulang.
      return NextResponse.json(
        { error: "Gagal menghapus akun login siswa. Tidak ada data yang berubah, silakan coba lagi." },
        { status: 502 },
      );
    }
    throw error;
  }

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "students",
    entitasId: id,
    before,
    after: ringkasanAuditHapus(mode),
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true, mode });
}
