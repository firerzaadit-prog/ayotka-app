import type { PrismaClient, TaxonomyMapping } from "@prisma/client";

export const SUMBER_SOAL_AYOTKA_ID = "soal-ayotka-id";

export interface TaxonomySourceLabel {
  elemen: string;
  subElemen: string | null;
  kompetensi: string | null;
}

/**
 * Kolom mana dari soal.ayotka.id yang jadi kunci pencocokan taksonomi,
 * tergantung mapel (dokumen Bagian 07): Bahasa Indonesia dicocokkan lewat
 * kompetensi (elemen-nya di sana kebanyakan cuma "Membaca dan Memirsa",
 * tidak cukup spesifik untuk dipetakan); mapel lain (Matematika, dst) lewat
 * elemen. Diekspor terpisah dari fungsi Prisma di bawah supaya bisa
 * ditest tanpa database.
 */
export function getTaxonomyMatchKey(mapel: string, source: TaxonomySourceLabel): string | null {
  if (mapel === "Bahasa Indonesia") return source.kompetensi;
  return source.elemen;
}

/** null berarti belum pernah dipetakan - pemanggil (Fase 3) yang menampilkan dropdown. */
export async function resolveTaxonomyMapping(
  prisma: PrismaClient,
  mapel: string,
  source: TaxonomySourceLabel,
): Promise<TaxonomyMapping | null> {
  const key = getTaxonomyMatchKey(mapel, source);
  if (!key) return null;

  if (mapel === "Bahasa Indonesia") {
    return prisma.taxonomyMapping.findFirst({
      where: { sumber: SUMBER_SOAL_AYOTKA_ID, sourceKompetensi: key },
    });
  }
  return prisma.taxonomyMapping.findFirst({
    where: { sumber: SUMBER_SOAL_AYOTKA_ID, sourceElemen: key },
  });
}

export async function createTaxonomyMapping(
  prisma: PrismaClient,
  params: {
    source: TaxonomySourceLabel;
    kompetensiId: string;
    createdBy: string;
  },
): Promise<TaxonomyMapping> {
  const { source, kompetensiId, createdBy } = params;
  return prisma.taxonomyMapping.create({
    data: {
      sumber: SUMBER_SOAL_AYOTKA_ID,
      sourceElemen: source.elemen,
      sourceSubElemen: source.subElemen,
      sourceKompetensi: source.kompetensi,
      kompetensiId,
      createdBy,
    },
  });
}
