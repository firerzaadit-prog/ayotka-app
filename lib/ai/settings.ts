import "server-only";
import { prisma } from "@/lib/db/prisma";

const SETTINGS_ID = "global";

/**
 * Upsert-on-read supaya baris "global" tidak bergantung pada seed script -
 * seed tidak otomatis jalan di produksi (Supabase), jadi kalau cuma dibaca
 * lewat findUnique, baris ini bisa tidak pernah ada sama sekali di prod.
 */
export async function getAiAutoAnalysisSettings() {
  return prisma.appSetting.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

export async function setAiAutoAnalysisMaxPerSubject(max: number) {
  return prisma.appSetting.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, aiAutoAnalysisMaxPerSubject: max },
    update: { aiAutoAnalysisMaxPerSubject: max },
  });
}
