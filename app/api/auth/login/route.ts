import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { getClientIp } from "@/lib/audit/log";
import { loginSchema } from "@/lib/validations/auth";

const ROLE_HOME: Record<string, string> = {
  siswa: "/siswa/dashboard",
  admin_sekolah: "/admin-sekolah/dashboard",
  admin_pusat: "/admin-pusat/dashboard",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Email atau password tidak valid." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return NextResponse.json(
      { error: "Email atau password salah." },
      { status: 401 },
    );
  }

  const role = (data.user.app_metadata as { role?: string }).role ?? "siswa";

  await prisma.$transaction([
    prisma.user.update({
      where: { id: data.user.id },
      data: { lastLoginAt: new Date() },
    }),
    prisma.loginLog.create({
      data: {
        userId: data.user.id,
        ip: getClientIp(request),
        device: request.headers.get("user-agent"),
      },
    }),
  ]);

  return NextResponse.json({ redirectTo: ROLE_HOME[role] ?? "/" });
}
