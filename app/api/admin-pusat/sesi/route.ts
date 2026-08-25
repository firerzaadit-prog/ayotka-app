import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

/**
 * Tiket 7.2 (Bagian 5 brief, "Monitoring Akses"): daftar sesi aktif = baris
 * login_logs yang belum ditutup (logout_at masih null). "Aktif" di sini
 * berarti "belum pernah logout tercatat sejak login itu", BUKAN jaminan
 * sesi Supabase-nya masih hidup detik ini juga (mis. tab ditutup tanpa
 * klik logout) - makanya login_at ikut ditampilkan di UI supaya admin bisa
 * menilai sendiri wajar-tidaknya, bukan pura-pura presisi real-time.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const sessions = await prisma.loginLog.findMany({
    where: { logoutAt: null },
    orderBy: { loginAt: "desc" },
    include: { user: { select: { email: true, role: true } } },
  });

  const siswaUserIds = sessions.filter((s) => s.user.role === "siswa").map((s) => s.userId);
  const students = siswaUserIds.length
    ? await prisma.student.findMany({
        where: { userId: { in: siswaUserIds } },
        select: { userId: true, nama: true },
      })
    : [];
  const namaByUserId = new Map(students.map((s) => [s.userId, s.nama]));

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      email: s.user.email,
      role: s.user.role,
      nama: namaByUserId.get(s.userId) ?? null,
      ip: s.ip,
      device: s.device,
      loginAt: s.loginAt,
    })),
  });
}
