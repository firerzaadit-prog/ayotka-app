import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const openSession = await prisma.loginLog.findFirst({
      where: { userId: user.id, logoutAt: null },
      orderBy: { loginAt: "desc" },
    });
    if (openSession) {
      await prisma.loginLog.update({
        where: { id: openSession.id },
        data: { logoutAt: new Date() },
      });
    }
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
