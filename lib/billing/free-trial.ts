import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getUsableSubscription } from "@/lib/billing/subscription-queries";

/**
 * Tiket 6.5 (Bagian 7.1 brief, "Uji coba gratis"): siswa mandiri (jalur B)
 * baru boleh akses 1 paket tanpa bayar; mencoba paket LAIN yang berbeda
 * diblokir sampai ada subscription yang masih berlaku (aktif/tenggang).
 * Mengerjakan ulang paket yang sama berkali-kali tetap boleh - yang
 * dibatasi jumlah paket berbeda yang pernah disentuh, bukan jumlah attempt
 * (attempt memang tidak dibatasi sistem, lihat keputusan #12 brief).
 */
export async function canStartMandiriPackage(
  userId: string,
  studentId: string,
  packageId: string,
): Promise<boolean> {
  const subscription = await getUsableSubscription(userId);
  if (subscription) return true;

  const attemptOnOtherPackage = await prisma.attempt.findFirst({
    where: { studentId, packageId: { not: packageId } },
    select: { id: true },
  });
  return !attemptOnOtherPackage;
}
