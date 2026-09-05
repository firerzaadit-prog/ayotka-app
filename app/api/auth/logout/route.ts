import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { closeOpenLoginSession } from "@/lib/auth/logout";
import { ACTING_AS_SCHOOL_COOKIE } from "@/lib/schools/scope";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await closeOpenLoginSession(user.id);
  }

  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  // Hapus konteks mode "Kelola Sekolah" supaya tidak nyangkut ke sesi
  // admin_pusat lain kalau browser ini dipakai bergantian (lihat
  // lib/schools/scope.ts).
  response.cookies.delete(ACTING_AS_SCHOOL_COOKIE);
  return response;
}
