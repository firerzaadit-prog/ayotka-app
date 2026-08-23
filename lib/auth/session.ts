import "server-only";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";
import type { Role, User } from "@prisma/client";

export type CurrentUser = Pick<
  User,
  "id" | "email" | "role" | "status" | "username"
>;

/**
 * Ambil user yang sedang login (Server Component/Route Handler/Server
 * Action - Node runtime). Role di tabel `users` (Prisma) adalah sumber
 * kebenaran untuk logic aplikasi; middleware.ts (Edge runtime, tidak bisa
 * akses Prisma) memakai salinan role di app_metadata Supabase Auth hanya
 * untuk gerbang cepat sebelum halaman dirender - lihat middleware.ts.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, email: true, role: true, status: true, username: true },
  });

  if (!user || user.status !== "aktif") return null;

  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !roles.includes(user.role)) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
