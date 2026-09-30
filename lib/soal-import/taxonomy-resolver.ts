import type { Prisma, PrismaClient, TaxonomyMapping } from "@prisma/client";

/** Prisma.TransactionClient (tanpa $transaction/$connect/dst) atau PrismaClient biasa - biar bisa dipakai di dalam maupun di luar transaksi. */
type PrismaLike = PrismaClient | Prisma.TransactionClient;

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
  prisma: PrismaLike,
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
  prisma: PrismaLike,
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

/**
 * Auto-resolve: cari Elemen yang sudah ada by (subjectId, nama), atau buat
 * baru. Cari Kompetensi yang sudah ada by (elemenId, subElemen, deskripsi),
 * atau buat baru. Simpan TaxonomyMapping supaya resolve berikutnya langsung
 * cache-hit.
 *
 * Ini dipanggil saat executeImport — admin tidak perlu mapping manual.
 */
export async function autoResolveOrCreateTaxonomy(
  prisma: PrismaLike,
  params: {
    subjectId: string;
    source: TaxonomySourceLabel;
    /** Level kognitif fallback kalau Kompetensi baru harus dibuat — diambil dari soal sumber. */
    levelKognitif: "L1" | "L2" | "L3";
    createdBy: string;
  },
): Promise<{ kompetensiId: string; elemenId: string }> {
  const { subjectId, source, levelKognitif, createdBy } = params;

  // 1. Find or create Elemen
  let elemen = await (prisma as PrismaLike & { elemen: PrismaClient["elemen"] }).elemen.findFirst({
    where: {
      subjectId,
      nama: { equals: source.elemen, mode: "insensitive" as const },
    },
  });
  if (!elemen) {
    // Hitung urutan terakhir
    const lastElemen = await (prisma as PrismaLike & { elemen: PrismaClient["elemen"] }).elemen.findFirst({
      where: { subjectId },
      orderBy: { urutan: "desc" },
      select: { urutan: true },
    });
    elemen = await (prisma as PrismaLike & { elemen: PrismaClient["elemen"] }).elemen.create({
      data: {
        subjectId,
        nama: source.elemen,
        urutan: (lastElemen?.urutan ?? -1) + 1,
        resmi: false,
      },
    });
  }

  // 2. Find or create Kompetensi
  const subElemen = source.subElemen ?? "";
  const deskripsi = source.kompetensi ?? source.elemen; // fallback: pakai elemen sebagai deskripsi
  let kompetensi = await (prisma as PrismaLike & { kompetensi: PrismaClient["kompetensi"] }).kompetensi.findFirst({
    where: {
      elemenId: elemen.id,
      subElemen: { equals: subElemen, mode: "insensitive" as const },
      deskripsi: { equals: deskripsi, mode: "insensitive" as const },
    },
  });
  if (!kompetensi) {
    kompetensi = await (prisma as PrismaLike & { kompetensi: PrismaClient["kompetensi"] }).kompetensi.create({
      data: {
        elemenId: elemen.id,
        subElemen,
        deskripsi,
        levelKognitif,
      },
    });
  }

  // 3. Simpan TaxonomyMapping supaya next time langsung cache-hit
  const key = getTaxonomyMatchKey("", source); // always use elemen key for auto-resolve
  const existingMapping = await prisma.taxonomyMapping.findFirst({
    where: {
      sumber: SUMBER_SOAL_AYOTKA_ID,
      sourceElemen: source.elemen,
      sourceSubElemen: source.subElemen ?? null,
      sourceKompetensi: source.kompetensi ?? null,
    },
  });
  if (!existingMapping) {
    await prisma.taxonomyMapping.create({
      data: {
        sumber: SUMBER_SOAL_AYOTKA_ID,
        sourceElemen: source.elemen,
        sourceSubElemen: source.subElemen,
        sourceKompetensi: source.kompetensi,
        kompetensiId: kompetensi.id,
        createdBy,
      },
    });
  }

  return { kompetensiId: kompetensi.id, elemenId: elemen.id };
}
