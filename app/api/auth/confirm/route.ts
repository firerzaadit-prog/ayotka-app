import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Tiket 1.6: penerima link email Supabase Auth (dipakai bersama untuk reset
 * password dan verifikasi email registrasi - dibedakan lewat parameter
 * `type` yang disertakan Supabase di link, lihat brief keputusan #22).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const errorUrl = new URL("/login", origin);
  errorUrl.searchParams.set(
    "error",
    "Link sudah kedaluwarsa atau tidak valid. Minta link baru.",
  );
  return NextResponse.redirect(errorUrl);
}
