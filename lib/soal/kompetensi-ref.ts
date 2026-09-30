import "server-only";
import { prisma } from "@/lib/db/prisma";
import { kompetensiKey, type KompetensiRef } from "@/lib/soal/excel-format";
import type { KompetensiReferensi } from "@/lib/soal/excel-io";

/**
 * Kombinasi (elemen, sub elemen, kompetensi) jadi kunci acuan impor Excel per
 * mata pelajaran (lihat loadKompetensiForSubject di bawah), jadi tidak boleh
 * kembar dalam satu elemen - kalau kembar, baris Excel diam-diam tertaut ke
 * salah satunya saja. Tidak peka huruf besar/kecil, sama seperti pencocokan
 * saat impor (lihat kompetensiKey).
 */
export async function kompetensiSudahDipakai(
  elemenId: string,
  subElemen: string,
  deskripsi: string,
  kecualiId?: string,
): Promise<boolean> {
  const kembar = await prisma.kompetensi.findFirst({
    where: {
      elemenId,
      subElemen: { equals: subElemen.trim(), mode: "insensitive" },
      deskripsi: { equals: deskripsi.trim(), mode: "insensitive" },
      ...(kecualiId ? { id: { not: kecualiId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(kembar);
}

/** Semua kompetensi milik mata pelajaran paket - kombinasi elemen/subElemen/deskripsi jadi kunci acuan di Excel. */
export async function loadKompetensiForSubject(subjectId: string) {
  const rows = await prisma.kompetensi.findMany({
    where: { elemen: { subjectId } },
    orderBy: [{ elemen: { nama: "asc" } }, { subElemen: "asc" }],
    select: {
      id: true,
      subElemen: true,
      deskripsi: true,
      levelKognitif: true,
      elemenId: true,
      elemen: { select: { nama: true } },
    },
  });

  const referensi: KompetensiReferensi[] = rows.map((k) => ({
    elemen: k.elemen.nama,
    subElemen: k.subElemen,
    deskripsi: k.deskripsi,
    levelKognitif: k.levelKognitif,
  }));

  const byKey = new Map<string, KompetensiRef>();
  for (const k of rows) {
    byKey.set(kompetensiKey(k.elemen.nama, k.subElemen, k.deskripsi), { id: k.id, elemenId: k.elemenId });
  }
  return { referensi, byKey };
}
