import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Tiket 1.6: penerima link email Supabase Auth (dipakai bersama untuk reset
 * password dan verifikasi email registrasi - dibedakan lewat parameter
 * `type` yang disertakan Supabase di link, lihat brief keputusan #22).
 *
 * GET hanya meneruskan token ke halaman /konfirmasi, TIDAK langsung
 * memvalidasinya - token baru dikonsumsi lewat POST di bawah, dipicu klik
 * tombol eksplisit pengguna. Ini sengaja: banyak email client/pemindai
 * keamanan (mis. gateway email korporat) otomatis meng-GET setiap tautan di
 * badan email untuk memindai sebelum pengguna sungguh membukanya. Token
 * verifyOtp cuma bisa dipakai sekali - kalau langsung dikonsumsi saat GET,
 * klik asli pengguna akan selalu gagal "kedaluwarsa" walau link baru
 * dikirim beberapa detik sebelumnya.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    const confirmUrl = new URL("/konfirmasi", origin);
    confirmUrl.searchParams.set("token_hash", tokenHash);
    confirmUrl.searchParams.set("type", type);
    confirmUrl.searchParams.set("next", next);
    return NextResponse.redirect(confirmUrl);
  }

  const errorUrl = new URL("/login", origin);
  errorUrl.searchParams.set(
    "error",
    "Link sudah kedaluwarsa atau tidak valid. Minta link baru.",
  );
  return NextResponse.redirect(errorUrl);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const tokenHash = typeof body?.token_hash === "string" ? body.token_hash : null;
  const type = typeof body?.type === "string" ? (body.type as EmailOtpType) : null;

  if (!tokenHash || !type) {
    return NextResponse.json({ error: "Link tidak valid." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.json(
      { error: "Link sudah kedaluwarsa atau tidak valid. Minta link baru." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
