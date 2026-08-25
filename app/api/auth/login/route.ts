import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validations/auth";

const ROLE_HOME: Record<string, string> = {
  siswa: "/siswa/dashboard",
  admin_sekolah: "/admin-sekolah/dashboard",
  admin_pusat: "/admin-pusat/dashboard",
};

/** Tiket 3.4: NISN adalah 10 digit angka murni - kalau tidak, perlakukan sebagai email. */
function resolveEmail(emailOrNisn: string): string {
  return /^\d{10}$/.test(emailOrNisn) ? `${emailOrNisn}@nisn.ayotka.id` : emailOrNisn;
}

export async function POST(request: Request) {
  const ip = getClientIp(request) ?? "unknown";
  if (!checkRateLimit(`login:${ip}`, 15, 60_000)) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan masuk, coba lagi sebentar lagi." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Email/NISN atau password tidak valid." },
      { status: 400 },
    );
  }

  const email = resolveEmail(parsed.data.emailOrNisn);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  // Beda dari kredensial salah (Supabase kasih error.code terpisah, lihat
  // node_modules/@supabase/auth-js) - siswa mandiri (Tiket 3.3) dibuat
  // dengan email belum terkonfirmasi, jadi ini gampang kejadian pas baru
  // daftar dan belum sempat klik link di emailnya. Kalau digabung jadi
  // pesan "salah password" generik, orangnya tidak tahu harus ngapain.
  if (error?.code === "email_not_confirmed") {
    return NextResponse.json(
      {
        error:
          "Email kamu belum dikonfirmasi. Cek kotak masuk (atau folder spam) untuk link konfirmasi yang dikirim saat mendaftar, lalu coba masuk lagi.",
      },
      { status: 401 },
    );
  }

  if (error || !data.user) {
    return NextResponse.json(
      { error: "Email/NISN atau password salah." },
      { status: 401 },
    );
  }

  const localUser = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: { status: true },
  });
  if (!localUser || localUser.status !== "aktif") {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Email/NISN atau password salah." },
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
        ip,
        device: request.headers.get("user-agent"),
      },
    }),
  ]);

  return NextResponse.json({ redirectTo: ROLE_HOME[role] ?? "/" });
}
