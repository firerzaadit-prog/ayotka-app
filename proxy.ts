import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Tiket 1.3: middleware RBAC. WAJIB di root proyek (sejajar app/, bukan di
 * dalamnya) - Next.js App Router hanya mengenali proxy/middleware di lokasi
 * ini. Semua pengecekan role terpusat di sini, jangan diulang manual per
 * halaman.
 *
 * Catatan: panduan teknis menyebut file ini "middleware.ts", tapi Next.js
 * 16 (versi terpasang di proyek ini) mengganti konvensinya jadi proxy.ts -
 * middleware.ts masih jalan tapi sudah deprecated. Ini file yang sama,
 * cuma nama & gaya export-nya menyesuaikan versi Next.js yang dipakai.
 *
 * Role diambil dari app_metadata token Supabase Auth (bukan query ke
 * Prisma/Postgres - proxy jalan di Edge runtime yang tidak mendukung
 * koneksi Postgres langsung). app_metadata hanya bisa ditulis lewat Admin
 * API (service_role), jadi tidak bisa dipalsukan user sendiri.
 */

const ROLE_HOME: Record<string, string> = {
  siswa: "/siswa/dashboard",
  admin_sekolah: "/admin-sekolah/dashboard",
  admin_pusat: "/admin-pusat/dashboard",
};

const ROLE_PREFIXES: Record<string, string> = {
  "/siswa": "siswa",
  "/admin-sekolah": "admin_sekolah",
  "/admin-pusat": "admin_pusat",
};

// "/reset-password" SENGAJA tidak dimasukkan ke sini. Kalau dimasukkan,
// user dengan must_change_password=true kena loop-redirect tak berujung:
// aturan di bawah memaksa mereka ke /reset-password, lalu blok ini
// langsung melempar mereka balik ke dashboard karena sudah login -
// dua aturan saling lempar selamanya (ERR_TOO_MANY_REDIRECTS).
const PUBLIC_AUTH_PATHS = ["/login", "/forgot-password"];

export default async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = (user?.app_metadata as { role?: string } | undefined)?.role;
  const mustChangePassword = Boolean(
    (user?.user_metadata as { must_change_password?: boolean } | undefined)
      ?.must_change_password,
  );
  const { pathname } = request.nextUrl;

  const matchedPrefix = Object.keys(ROLE_PREFIXES).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (matchedPrefix) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const requiredRole = ROLE_PREFIXES[matchedPrefix];
    if (role !== requiredRole) {
      const home = role ? (ROLE_HOME[role] ?? "/login") : "/login";
      return NextResponse.redirect(new URL(home, request.url));
    }

    // Akun admin sekolah baru (Tiket 1.5) wajib ganti password sementara
    // sebelum bisa membuka halaman lain manapun.
    if (mustChangePassword && pathname !== "/reset-password") {
      return NextResponse.redirect(new URL("/reset-password", request.url));
    }
  }

  if (user && role && PUBLIC_AUTH_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? "/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Cocokkan semua path kecuali file statis Next.js dan aset publik,
     * supaya sesi Supabase tetap ter-refresh di setiap navigasi.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
