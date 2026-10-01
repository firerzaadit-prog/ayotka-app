import type { Prisma, PrismaClient, TaxonomyMapping } from "@prisma/client";

/** Prisma.TransactionClient (tanpa $transaction/$connect/dst) atau PrismaClient biasa - biar bisa dipakai di dalam maupun di luar transaksi. */
type PrismaLike = PrismaClient | Prisma.TransactionClient;

export const SUMBER_SOAL_AYOTKA_ID = "soal-ayotka-id";

/** Nilai pengganti kalau soal sumber tidak punya sub elemen. */
export const SUB_ELEMEN_DEFAULT = "Umum";

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

  // Nilai dipangkas dulu: spasi nyasar di label sumber tidak boleh melahirkan
  // Elemen/Kompetensi "kembar" yang beda cuma spasi.
  const elemenNama = source.elemen.trim();
  // Sub elemen kosong di sumber -> "Umum" (kolom subElemen wajib terisi supaya
  // kunci Excel & cek duplikat tidak ambigu antara null dan string kosong).
  const subElemen = source.subElemen?.trim() || SUB_ELEMEN_DEFAULT;
  const deskripsi = source.kompetensi?.trim() || elemenNama; // fallback: pakai elemen sebagai deskripsi

  // 1. Find or create Elemen
  let elemen = await prisma.elemen.findFirst({
    where: { subjectId, nama: { equals: elemenNama, mode: "insensitive" } },
  });
  if (!elemen) {
    const lastElemen = await prisma.elemen.findFirst({
      where: { subjectId },
      orderBy: { urutan: "desc" },
      select: { urutan: true },
    });
    elemen = await prisma.elemen.create({
      data: { subjectId, nama: elemenNama, urutan: (lastElemen?.urutan ?? -1) + 1, resmi: false },
    });
  }

  // 2. Find or create Kompetensi
  let kompetensi = await prisma.kompetensi.findFirst({
    where: {
      elemenId: elemen.id,
      subElemen: { equals: subElemen, mode: "insensitive" },
      deskripsi: { equals: deskripsi, mode: "insensitive" },
    },
  });
  if (!kompetensi) {
    kompetensi = await prisma.kompetensi.create({
      data: { elemenId: elemen.id, subElemen, deskripsi, levelKognitif },
    });
  }

  // 3. Simpan TaxonomyMapping supaya next time langsung cache-hit
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
