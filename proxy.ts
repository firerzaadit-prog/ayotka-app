import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
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
  dinas_pendidikan: "/dinas-pendidikan/dashboard",
  mitra: "/mitra/dashboard",
};

// Sebagian besar prefix cuma untuk satu role, tapi /admin-sekolah juga
// dibuka untuk admin_pusat - mode "Kelola Sekolah" (lihat
// app/admin-sekolah/layout.tsx & lib/schools/scope.ts) memakai halaman
// admin sekolah yang sama persis, jadi admin_pusat harus lolos gerbang
// role di sini juga, bukan cuma di requireRole tiap route API-nya.
const ROLE_PREFIXES: Record<string, string[]> = {
  "/siswa": ["siswa"],
  "/admin-sekolah": ["admin_sekolah", "admin_pusat"],
  "/admin-pusat": ["admin_pusat"],
  "/dinas-pendidikan": ["dinas_pendidikan"],
  "/mitra": ["mitra"],
};

// Pintu masuk login beda per role (lihat app/login, app/admin/admin-pusat,
// app/admin/admin-sekolah, app/admin/dinas-pendidikan) - dipakai untuk
// redirect pengunjung yang belum login DAN untuk tahu path mana yang harus
// dianggap "halaman auth publik" di bawah.
const ROLE_LOGIN_PATH: Record<string, string> = {
  siswa: "/login",
  admin_sekolah: "/admin/admin-sekolah",
  admin_pusat: "/admin/admin-pusat",
  dinas_pendidikan: "/admin/dinas-pendidikan",
  mitra: "/mitra/login",
};

// "/reset-password" SENGAJA tidak dimasukkan ke sini. Kalau dimasukkan,
// user dengan must_change_password=true kena loop-redirect tak berujung:
// aturan di bawah memaksa mereka ke /reset-password, lalu blok ini
// langsung melempar mereka balik ke dashboard karena sudah login -
// dua aturan saling lempar selamanya (ERR_TOO_MANY_REDIRECTS).
const PUBLIC_AUTH_PATHS = [
  "/login",
  "/forgot-password",
  "/registrasi",
  "/registrasi/mitra",
  "/registrasi/sekolah",
  "/registrasi/mandiri",
  "/admin/mitra",
  "/login/mitra",
  "/mitra/login",
  "/admin/admin-sekolah",
  "/admin/admin-pusat",
  "/admin/dinas-pendidikan",
];

// Status maintenance dibaca pakai service_role (proxy jalan di server - Node.js
// runtime - jadi kuncinya tidak pernah sampai ke browser). Dulu pakai anon key,
// sehingga tabel app_settings harus dibuka untuk publik lewat RLS dan ikut
// membocorkan kunci bypass maintenance serta kolom kunci API terenkripsi.
// Hasilnya disimpan sebentar di memori supaya tidak menambah satu panggilan ke
// Supabase di setiap request: toggle maintenance berlaku paling lambat
// MAINTENANCE_CACHE_MS setelah disimpan.
const MAINTENANCE_CACHE_MS = 10_000;
let maintenanceCache: { at: number; mode: boolean; secret: string | null } | null = null;

async function readMaintenanceSetting() {
  if (maintenanceCache && Date.now() - maintenanceCache.at < MAINTENANCE_CACHE_MS) {
    return maintenanceCache;
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  try {
    const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin
      .from("app_settings")
      .select("maintenance_mode, maintenance_bypass_secret")
      .eq("id", "global")
      .maybeSingle();
    // Query gagal sesaat: pakai nilai terakhir yang diketahui.
    if (error) return maintenanceCache;
    maintenanceCache = {
      at: Date.now(),
      mode: Boolean(data?.maintenance_mode),
      secret: data?.maintenance_bypass_secret || null,
    };
    return maintenanceCache;
  } catch {
    return maintenanceCache;
  }
}

export default async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
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

  // Cek mode maintenance: prioritas env var -> lalu cek status toggle database
  let isMaintenance = process.env.MAINTENANCE_MODE === "true";
  // Tidak ada kunci bypass bawaan: repo ini publik, kunci yang tertulis di
  // kode sama saja dengan tanpa kunci. Tanpa kunci, hanya admin pusat yang lolos.
  let bypassSecret: string | null = process.env.MAINTENANCE_BYPASS_SECRET || null;

  if (!isMaintenance) {
    const setting = await readMaintenanceSetting();
    if (setting?.mode) {
      isMaintenance = true;
      if (setting.secret) bypassSecret = setting.secret;
    }
  }

  const queryBypass = searchParams.get("bypass");
  const cookieBypass = request.cookies.get("maintenance_bypass")?.value;
  // Admin pusat yang sedang login otomatis dibebaskan agar tidak terkunci
  const isBypassed =
    role === "admin_pusat" ||
    (bypassSecret !== null && (queryBypass === bypassSecret || cookieBypass === bypassSecret));

  if (pathname === "/maintenance") {
    // Jika sistem TIDAK sedang maintenance (atau user memiliki akses bypass),
    // jangan tahan user di /maintenance, arahkan kembali ke homepage /
    if (!isMaintenance || isBypassed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    // Jika memang sedang maintenance dan user reguler, tampilkan halaman maintenance
    return NextResponse.next();
  }

  if (isMaintenance) {
    if (isBypassed) {
      if (bypassSecret && queryBypass === bypassSecret) {
        response.cookies.set("maintenance_bypass", bypassSecret, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
        });
      }
      // Lanjutkan ke pengecekan navigasi normal di bawah
    } else {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Sistem sedang dalam pemeliharaan berkala.", maintenance: true },
          { status: 503, headers: { "Retry-After": "3600" } },
        );
      }
      return NextResponse.redirect(new URL("/maintenance", request.url));
    }
  }
  // 1. Cek halaman autentikasi publik (login / registrasi / forgot password)
  const isPublicAuthPath = PUBLIC_AUTH_PATHS.some(
    (authPath) => pathname === authPath || pathname.startsWith(`${authPath}/`),
  );

  if (isPublicAuthPath) {
    if (user && role) {
      // Khusus login mitra: jika sudah login sebagai mitra, ke dashboard mitra
      if (pathname === "/mitra/login" || pathname === "/login/mitra" || pathname === "/admin/mitra") {
        if (role === "mitra") {
          return NextResponse.redirect(new URL("/mitra/dashboard", request.url));
        }
        // Jika user login sebagai role lain (mis. siswa), tapi membuka login mitra,
        // izinkan membuka halaman login mitra
        return response;
      }

      if (pathname === "/login") {
        if (role === "siswa") {
          return NextResponse.redirect(new URL("/siswa/dashboard", request.url));
        }
        return response;
      }

      if (pathname.startsWith("/registrasi")) {
        return NextResponse.redirect(new URL(ROLE_HOME[role] ?? "/", request.url));
      }

      if (ROLE_HOME[role]) {
        return NextResponse.redirect(new URL(ROLE_HOME[role]!, request.url));
      }
    }

    // Jika belum login, izinkan langsung render halaman login/registrasi tanpa redirect
    return response;
  }

  // 2. Proteksi rute berdasarkan Role
  const matchedPrefix = Object.keys(ROLE_PREFIXES).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (matchedPrefix) {
    const requiredRoles = ROLE_PREFIXES[matchedPrefix]!;

    if (!user) {
      // Belum login: arahkan ke login role utama prefix ini
      const loginPath = ROLE_LOGIN_PATH[requiredRoles[0]!] ?? "/login";
      const loginUrl = new URL(loginPath, request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!role || !requiredRoles.includes(role)) {
      const home = role ? (ROLE_HOME[role] ?? "/login") : "/login";
      return NextResponse.redirect(new URL(home, request.url));
    }

    // Akun admin sekolah baru (Tiket 1.5) wajib ganti password sementara
    // sebelum bisa membuka halaman lain manapun.
    if (mustChangePassword && pathname !== "/reset-password") {
      return NextResponse.redirect(new URL("/reset-password", request.url));
    }
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
