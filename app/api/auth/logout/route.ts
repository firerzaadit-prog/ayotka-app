import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { closeOpenLoginSession } from "@/lib/auth/logout";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await closeOpenLoginSession(user.id);
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
