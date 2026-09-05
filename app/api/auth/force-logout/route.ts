import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { closeOpenLoginSession } from "@/lib/auth/logout";
import { ACTING_AS_SCHOOL_COOKIE } from "@/lib/schools/scope";

/**
 * Dituju lewat redirect() dari layout ber-role (bukan fetch dari client),
 * dipakai ketika akun sudah dinonaktifkan (users.status != "aktif") tapi
 * sesi Supabase-nya masih valid - mis. siswa yang baru dihapus (soft
 * delete) tapi sesi browsernya belum kedaluwarsa. redirect("/login")
 * langsung dari Server Component macet total: proxy.ts (Edge, tidak bisa
 * baca Prisma) masih melihat sesi Supabase valid + role masih ada di
 * app_metadata, jadi begitu mendarat di /login langsung dilempar balik ke
 * halaman role tadi - loop tanpa akhir. Server Component tidak boleh
 * menulis cookie, jadi signOut() perlu dijalankan di Route Handler ini
 * dulu supaya proxy.ts benar-benar tidak lagi melihat sesi valid saat
 * redirect ke /login berikutnya.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await closeOpenLoginSession(user.id);
  }
  await supabase.auth.signOut();

  const next = new URL(request.url).searchParams.get("next") ?? "/login";
  const response = NextResponse.redirect(new URL(next, request.url));
  // Hapus konteks mode "Kelola Sekolah" supaya tidak nyangkut ke sesi
  // admin_pusat lain kalau browser ini dipakai bergantian (lihat
  // lib/schools/scope.ts).
  response.cookies.delete(ACTING_AS_SCHOOL_COOKIE);
  return response;
}
