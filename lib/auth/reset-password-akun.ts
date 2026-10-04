import "server-only";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { generateTempPassword } from "@/lib/utils/generate-code";

/**
 * Reset kata sandi akun login oleh admin pusat: dibuat kata sandi SEMENTARA baru yang dikembalikan sekali di
 * respons (tidak pernah disimpan, dicatat di audit, atau dikirim lewat email) dan akunnya ditandai
 * must_change_password supaya pemiliknya wajib menggantinya saat login berikutnya - pola yang sama dengan
 * pembuatan akun dan reset kata sandi siswa (app/api/admin-sekolah/siswa/[id]/reset-password).
 */
export type HasilAturUlang = { ok: true; tempPassword: string } | { ok: false; status: number; error: string };

type DepsAturUlang = { admin?: () => ReturnType<typeof createAdminClient>; buatSandi?: () => string };

export async function aturUlangKataSandiAkun(userId: string, deps: DepsAturUlang = {}): Promise<HasilAturUlang> {
  const supabaseAdmin = (deps.admin ?? createAdminClient)();
  const sandi = (deps.buatSandi ?? generateTempPassword)();

  const { data, error: galatBaca } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (galatBaca) {
    return { ok: false, status: 502, error: `Gagal membaca akun login: ${galatBaca.message}` };
  }
  if (!data.user) {
    return { ok: false, status: 404, error: "Akun login tidak ditemukan." };
  }

  // user_metadata digabung secara eksplisit (nama dan lainnya dipertahankan), bukan bergantung pada perilaku penggabungan API.
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: sandi,
    user_metadata: { ...(data.user.user_metadata ?? {}), must_change_password: true },
  });
  if (error) {
    return { ok: false, status: 502, error: `Gagal reset password: ${error.message}` };
  }
  return { ok: true, tempPassword: sandi };
}

/**
 * Jalur lengkap untuk rute admin pusat: pastikan akun ada dan berperan `peranDiharapkan` (supaya satu rute tidak bisa
 * dipakai mereset akun jenis lain), atur ulang, catat audit TANPA kata sandi, lalu bentuk respons.
 */
export async function resetAkunOlehAdminPusat(opsi: {
  aktorId: string;
  userId: string;
  peranDiharapkan: Role;
  ip?: string | null;
}): Promise<NextResponse> {
  const user = await prisma.user.findUnique({ where: { id: opsi.userId }, select: { id: true, email: true, role: true } });
  if (!user || user.role !== opsi.peranDiharapkan) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  const hasil = await aturUlangKataSandiAkun(user.id);
  if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: hasil.status });

  await logAudit({
    userId: opsi.aktorId,
    aksi: "update",
    entitas: "users",
    entitasId: user.id,
    after: { aksi: "reset_password", peran: user.role },
    ip: opsi.ip ?? undefined,
  });

  return NextResponse.json({ email: user.email, tempPassword: hasil.tempPassword });
}
