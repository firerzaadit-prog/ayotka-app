import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { getClientIp } from "@/lib/audit/log";
import { checkRateLimit, isRateLimited, recordRateLimitHit } from "@/lib/rate-limit";
import { getLoginLimits } from "@/lib/auth/login-limit";
import { loginSchema } from "@/lib/validations/auth";
import { hasActiveSchoolAccess } from "@/lib/auth/session";

const ROLE_HOME: Record<string, string> = {
  siswa: "/siswa/dashboard",
  admin_sekolah: "/admin-sekolah/dashboard",
  admin_pusat: "/admin-pusat/dashboard",
  dinas_pendidikan: "/dinas-pendidikan/dashboard",
  mitra: "/mitra/dashboard",
};

/** Tiket 3.4: NISN adalah 10 digit angka murni - kalau tidak, perlakukan sebagai email. */
function resolveEmail(emailOrNisn: string): string {
  return /^\d{10}$/.test(emailOrNisn) ? `${emailOrNisn}@nisn.ayotka.id` : emailOrNisn;
}

const LOGIN_JENDELA_MS = 60_000;

/**
 * Galat dari layanan login yang BUKAN urusan kredensial: tidak terjangkau (status 0 / galat jaringan), dibatasi
 * penyedia (402), atau galat server (>= 500, termasuk jawaban non-JSON dari gerbang). Kredensial salah, email belum
 * dikonfirmasi, akun diblokir, dan batas laju (429) punya status 400-429 dan ditangani terpisah.
 */
function layananLoginBermasalah(error: { status?: number; name?: string } | null): boolean {
  if (!error) return false;
  const status = error.status;
  if (typeof status === "number" && (status === 0 || status === 402 || status >= 500)) return true;
  return error.name === "AuthRetryableFetchError" || error.name === "AuthUnknownError";
}

function terlaluBanyakPercobaan() {
  return NextResponse.json(
    { error: "Terlalu banyak percobaan masuk, coba lagi sebentar lagi." },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}

export async function POST(request: Request) {
  const ip = getClientIp(request) ?? "unknown";
  // Yang dibatasi KEGAGALAN (lihat lib/auth/login-limit.ts), bukan semua percobaan: satu kelas/lab
  // sekolah yang keluar lewat satu IP publik bisa login serentak selama kata sandinya benar.
  // Langit-langit semua percobaan per IP hanya menahan banjir permintaan.
  const limits = getLoginLimits();
  const kunciGagalIp = `login:gagal-ip:${ip}`;
  if (
    !checkRateLimit(`login:semua:${ip}`, limits.maksPerIp, LOGIN_JENDELA_MS) ||
    isRateLimited(kunciGagalIp, limits.gagalPerIp)
  ) {
    return terlaluBanyakPercobaan();
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
  // NISN & email untuk akun yang sama (dan beda huruf besar/kecil) harus dihitung sebagai satu akun.
  const kunciGagalAkun = `login:gagal-akun:${ip}:${email.trim().toLowerCase()}`;
  if (isRateLimited(kunciGagalAkun, limits.gagalPerAkun)) {
    return terlaluBanyakPercobaan();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  // Supabase Auth punya batas lajunya sendiri (per IP server kita). Kalau terkena, itu BUKAN
  // salah kata sandi - jangan dilaporkan sebagai "password salah" (siswa jadi mengetik ulang
  // berkali-kali) dan jangan dihitung sebagai kegagalan login siswa.
  if (error?.code === "over_request_rate_limit" || error?.status === 429) {
    console.warn("[login] ditolak batas laju Supabase Auth:", error.code ?? error.status);
    return NextResponse.json(
      { error: "Sistem sedang ramai. Tunggu beberapa saat lalu coba masuk lagi." },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }

  // Layanan login sendiri yang bermasalah (dibatasi/diblokir penyedia, mati, atau jawabannya bukan JSON) - BUKAN
  // salah kata sandi. Dulu jatuh ke pesan "password salah" di bawah: siswa mengetik ulang berkali-kali dan admin
  // mengira kata sandinya yang bermasalah, padahal yang mati layanannya (6 Okt 2026: HTTP 402 exceed_egress_quota).
  // Tidak dihitung sebagai kegagalan login supaya tidak ikut memicu pembatas kita.
  if (layananLoginBermasalah(error)) {
    console.error("[login] layanan autentikasi bermasalah:", error?.status ?? "-", error?.code ?? error?.name ?? "-");
    return NextResponse.json(
      {
        error: "Layanan masuk sedang gangguan. Kata sandimu bukan masalahnya - coba lagi beberapa saat lagi.",
        code: "LAYANAN_LOGIN_GANGGUAN",
      },
      { status: 503, headers: { "Retry-After": "60" } },
    );
  }

  // Beda dari kredensial salah (Supabase kasih error.code terpisah, lihat
  // node_modules/@supabase/auth-js) - siswa mandiri (Tiket 3.3) dibuat
  // dengan email belum terkonfirmasi, jadi ini gampang kejadian pas baru
  // daftar dan belum sempat klik link di emailnya. Kalau digabung jadi
  // pesan "salah password" generik, orangnya tidak tahu harus ngapain.
  if (error?.code === "email_not_confirmed") {
    return NextResponse.json(
      {
        error:
          "Email kamu belum dikonfirmasi. Cek kotak masuk (atau folder spam) untuk link konfirmasi yang dikirim saat mendaftar, lalu coba masuk lagi. Belum menerima emailnya? Kirim ulang lewat tombol di bawah.",
        code: "EMAIL_BELUM_DIKONFIRMASI",
      },
      { status: 401 },
    );
  }

  // Satu-satunya yang pernah pasang ban_duration di akun manapun adalah
  // fitur force logout (Tiket 7.2, app/api/admin-pusat/sesi/[id]/force-logout) -
  // jadi pesannya aman spesifik. Sama seperti email_not_confirmed di atas,
  // baru terungkap setelah password terbukti benar, jadi tidak menambah
  // celah menebak akun.
  if (error?.code === "user_banned") {
    return NextResponse.json(
      {
        error:
          "Akun ini baru saja di-paksa logout oleh admin. Coba masuk lagi dalam beberapa menit.",
      },
      { status: 401 },
    );
  }

  if (error || !data.user) {
    // Satu-satunya jalur yang dihitung sebagai kegagalan: kredensial salah / akun tidak dikenal.
    // Kasus lain di atas & di bawah (belum konfirmasi, dibanned, salah portal, dst.) terjadi
    // SETELAH kata sandi terbukti benar, jadi bukan penebakan dan tidak dihitung.
    recordRateLimitHit(kunciGagalIp, LOGIN_JENDELA_MS);
    recordRateLimitHit(kunciGagalAkun, LOGIN_JENDELA_MS);
    return NextResponse.json(
      { error: "Email/NISN atau password salah." },
      { status: 401 },
    );
  }

  const localUser = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: { status: true, role: true },
  });
  if (!localUser || localUser.status !== "aktif") {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.json(
      { error: "Email/NISN atau password salah." },
      { status: 401 },
    );
  }

  const role = (data.user.app_metadata as { role?: string }).role ?? "siswa";

  // Tiket keamanan portal: kalau pengirim menyertakan field `portal`, pastikan
  // role akun yang baru login sesuai dengan portal yang digunakan. Misalnya,
  // akun admin_pusat tidak boleh bisa masuk lewat halaman login siswa (/login).
  // Error ini aman diungkap karena hanya tercapai setelah password terbukti
  // benar - sama seperti pola email_not_confirmed & user_banned di atas.
  const portal = parsed.data.portal;
  if (portal && role !== portal) {
    // Khusus /admin-sekolah: admin_pusat memang boleh masuk lewat portal
    // admin_sekolah (mode "Kelola Sekolah" - lihat proxy.ts ROLE_PREFIXES).
    const isAdminPusatOnSekolahPortal =
      portal === "admin_sekolah" && role === "admin_pusat";
    if (!isAdminPusatOnSekolahPortal) {
      await supabase.auth.signOut({ scope: "local" });
      const PORTAL_LABEL: Record<string, string> = {
        siswa: "siswa",
        admin_sekolah: "admin sekolah",
        admin_pusat: "admin pusat",
        dinas_pendidikan: "dinas pendidikan",
        mitra: "mitra",
      };
      return NextResponse.json(
        {
          error: `Halaman ini hanya untuk ${PORTAL_LABEL[portal] ?? portal}. Silakan gunakan halaman login yang sesuai dengan akun kamu.`,
        },
        { status: 403 },
      );
    }
  }

  // Beda dari status akun (di atas): ini soal status SEKOLAHNYA (belum diverifikasi atau ditangguhkan admin
  // pusat), bukan akunnya sendiri - kredensialnya valid & akunnya aktif, jadi wajar dikasih alasan jelas
  // (bukan pesan generik) supaya tahu harus hubungi siapa. Langganan yang berakhir TIDAK memutus login:
  // sekolah "dibekukan" (tidak bisa mulai ujian baru) tetapi riwayat dan nilai tetap bisa dibuka. Cek ini
  // aman diungkap karena cuma tercapai setelah password terbukti benar (sama seperti email_not_confirmed di
  // atas), jadi tidak menambah celah untuk menebak akun yang valid.
  if (!(await hasActiveSchoolAccess(data.user.id, localUser.role))) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.json(
      {
        error:
          "Sekolahmu belum diaktifkan atau sedang ditangguhkan, jadi akun ini belum bisa masuk. Hubungi admin sekolah atau admin pusat AyoTKA.",
      },
      { status: 403 },
    );
  }

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
