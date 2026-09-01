import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { CurrentUser } from "@/lib/auth/session";

/**
 * Tiket 2.3/2.4: paket dimiliki pusat ATAU sekolah (packages.owner_type).
 * Helper ini menentukan owner_type/owner_id yang benar untuk user yang
 * sedang login, dipakai di semua route paket & soal supaya scoping
 * konsisten (admin sekolah tidak pernah bisa sentuh paket sekolah lain).
 */
export async function getOwnerScope(
  user: CurrentUser,
): Promise<{ ownerType: "pusat" | "sekolah"; ownerId: string } | null> {
  if (user.role === "admin_pusat") {
    return { ownerType: "pusat", ownerId: user.id };
  }

  if (user.role === "admin_sekolah") {
    const schoolUser = await prisma.schoolUser.findFirst({ where: { userId: user.id } });
    if (!schoolUser) return null;
    return { ownerType: "sekolah", ownerId: schoolUser.schoolId };
  }

  return null;
}

/** Pastikan paket ini benar milik scope user yang sedang login. */
export async function assertOwnsPackage(
  user: CurrentUser,
  packageId: string,
): Promise<boolean> {
  const scope = await getOwnerScope(user);
  if (!scope) return false;

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    select: { ownerType: true, ownerId: true },
  });
  if (!pkg) return false;

  return pkg.ownerType === scope.ownerType && pkg.ownerId === scope.ownerId;
}

/**
 * Cegah owner (pusat/sekolah) menggabungkan paketnya ke grup_paralel_id yang
 * anggotanya sudah ada tapi dimiliki owner LAIN - lib/exam/distribution.ts
 * memilih otomatis salah satu paket segrup untuk siswa mana pun yang pakai
 * grup itu, jadi bergabung ke grup asing = menyusupkan soal/kunci jawaban
 * ke ujian pihak lain. Grup yang belum punya anggota (baru) selalu boleh.
 */
export async function assertGrupParalelOwnedBySelf(
  scope: { ownerType: "pusat" | "sekolah"; ownerId: string },
  grupParalelId: string,
): Promise<boolean> {
  const members = await prisma.package.findMany({
    where: { grupParalelId },
    select: { ownerType: true, ownerId: true },
  });
  return members.every((m) => m.ownerType === scope.ownerType && m.ownerId === scope.ownerId);
}
