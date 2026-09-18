import "server-only";
import { prisma } from "@/lib/db/prisma";
import { generateReadableCode } from "@/lib/utils/generate-code";

/** Kode referral mitra (dulu cuma dibuat admin pusat, sekarang dipakai juga saat mitra daftar sendiri). */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReadableCode(6);
    const existing = await prisma.partner.findUnique({ where: { referralCode: code } });
    if (!existing) return code;
  }
  throw new Error("Gagal membuat kode referral unik, coba lagi.");
}
