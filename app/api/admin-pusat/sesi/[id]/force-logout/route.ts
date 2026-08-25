import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit, getClientIp } from "@/lib/audit/log";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Tiket 7.2: "klik force logout benar-benar mengeluarkan user dari sesi
 * tersebut" - menutup login_logs saja TIDAK cukup, itu cuma catatan kita,
 * sesi Supabase (JWT) targetnya tetap hidup dan tetap bisa dipakai. Supabase
 * Admin API tidak punya "invalidate sesi milik user X" langsung (auth-js
 * GoTrueAdminApi.signOut butuh JWT sesi itu sendiri, bukan user id) - jalan
 * yang benar-benar mematikannya adalah ban_duration singkat lewat
 * updateUserById. proxy.ts & getCurrentUser() memanggil supabase.auth.getUser()
 * di HAMPIR SETIAP request (request ke server Supabase sungguhan, bukan
 * decode JWT lokal), jadi begitu ban aktif, request berikutnya dari sesi
 * manapun milik user itu langsung ditolak Supabase sendiri - tidak perlu
 * kita lacak device/tab mana yang aktif.
 *
 * Sengaja ban SEMENTARA (5 menit), bukan permanen: ini "keluarkan dari sesi
 * sekarang", bukan "blokir akun". Supabase otomatis melepas ban setelah
 * durasinya habis, tidak perlu job/cron balik untuk un-ban.
 */
const FORCE_LOGOUT_BAN_DURATION = "5m";

export async function POST(request: Request, { params }: RouteParams) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const session = await prisma.loginLog.findUnique({
    where: { id },
    include: { user: { select: { email: true } } },
  });
  if (!session) {
    return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(session.userId, {
    ban_duration: FORCE_LOGOUT_BAN_DURATION,
  });
  if (error) {
    return NextResponse.json(
      { error: `Gagal memutus sesi: ${error.message}` },
      { status: 502 },
    );
  }

  await prisma.loginLog.updateMany({
    where: { userId: session.userId, logoutAt: null },
    data: { logoutAt: new Date() },
  });

  await logAudit({
    userId: actor.id,
    aksi: "update",
    entitas: "login_logs",
    entitasId: session.userId,
    after: { forceLogout: true, targetEmail: session.user.email },
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
