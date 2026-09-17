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

/** Bagian D/G (permintaan user): harga jual satu Learning Analytics tambahan, didebit dari saldo siswa. */
export async function setHargaLearningAnalytics(harga: number) {
  return prisma.appSetting.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, hargaLearningAnalytics: harga },
    update: { hargaLearningAnalytics: harga },
  });
}

/** Bagian D (permintaan user): margin keuntungan per transaksi LA tambahan, dapat diatur admin pusat. */
export async function setMarginLearningAnalytics(persen: number) {
  return prisma.appSetting.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, marginLearningAnalyticsPersen: persen },
    update: { marginLearningAnalyticsPersen: persen },
  });
}

