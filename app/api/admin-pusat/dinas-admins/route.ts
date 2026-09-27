import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { generateTempPassword } from "@/lib/utils/generate-code";
import { dinasAdminCreateSchema } from "@/lib/validations/dinas-pendidikan";

export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { role: "dinas_pendidikan" },
    select: { id: true, email: true, status: true, dinasProfile: true },
    orderBy: { email: "asc" },
  });

  // Akun bisa saja belum punya profil dinas (mis. dibuat sebelum kolom
  // wilayah ada) - tetap ditampilkan supaya admin pusat sadar dan bisa
  // melengkapi lewat PATCH, bukan hilang diam-diam dari daftar.
  const dinasAdmins = users.map((u) => ({
    id: u.id,
    email: u.email,
    status: u.status,
    nama: u.dinasProfile?.nama ?? null,
    instansi: u.dinasProfile?.instansi ?? null,
    kabupatenKota: u.dinasProfile?.kabupatenKota ?? null,
  }));

  return NextResponse.json({ dinasAdmins });
}

/**
 * Admin pusat membuat akun dinas pendidikan (read-only, akses kesiapan TKA
 * lintas sekolah), diikat ke SATU kota/kabupaten wilayah cakupannya - semua
 * endpoint /api/dinas-pendidikan/* otomatis memfilter berdasarkan wilayah ini
 * (lihat lib/dinas/wilayah.ts). Boleh ada lebih dari satu akun dinas untuk
 * kota/kabupaten yang sama maupun berbeda - tidak ada batasan satu akun per
 * wilayah, supaya bisa dibuatkan akun cadangan atau beberapa penanggung jawab.
 *
 * Pola sama persis dengan pembuatan akun admin sekolah
 * (app/api/admin-pusat/school-admins), cuma baris profilnya masuk tabel
 * DinasAdmin (bukan SchoolUser) karena akses dinas memang lintas sekolah.
 * Password sementara HANYA dikembalikan sekali di response ini, tidak pernah
 * disimpan.
 */
export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = dinasAdminCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { email, nama, instansi, kabupatenKota } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "Email ini sudah dipakai akun lain." }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { role: "dinas_pendidikan" },
    user_metadata: { must_change_password: true, nama, instansi },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: `Gagal membuat akun: ${error?.message ?? "unknown error"}` },
      { status: 502 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: { id: data.user.id, email, role: "dinas_pendidikan", status: "aktif" },
      });
      await tx.dinasAdmin.create({
        data: { userId: data.user.id, nama, instansi, kabupatenKota },
      });
    });
  } catch (err) {
    // Baris User/DinasAdmin gagal disimpan: akun login yang sudah terlanjur
    // dibuat dihapus lagi supaya emailnya bisa dipakai coba lagi (sama pola
    // dengan registrasi mandiri/mitra, lihat catatan di sana).
    await supabaseAdmin.auth.admin.deleteUser(data.user.id).catch(() => {});
    console.error("[admin-pusat/dinas-admins] gagal membuat akun:", err);
    return NextResponse.json(
      { error: "Akun belum bisa dibuat karena terjadi gangguan. Silakan coba lagi." },
      { status: 502 },
    );
  }

  await logAudit({
    userId: actor.id,
    aksi: "create",
    entitas: "users",
    entitasId: data.user.id,
    after: { userId: data.user.id, email, role: "dinas_pendidikan", nama, instansi, kabupatenKota },
    ip: getClientIp(request),
  });

  return NextResponse.json({ user: { id: data.user.id, email }, tempPassword }, { status: 201 });
}
