import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { KompetensiRef } from "@/lib/soal/excel-format";
import type { KompetensiReferensi } from "@/lib/soal/excel-io";

/**
 * Kode kompetensi jadi kunci acuan impor Excel per mata pelajaran (lihat
 * loadKompetensiForSubject di bawah), jadi tidak boleh kembar dalam satu mapel -
 * kalau kembar, baris Excel diam-diam tertaut ke salah satunya saja. Tidak peka
 * huruf besar/kecil, sama seperti pencocokan saat impor.
 */
export async function kodeKompetensiSudahDipakai(kode: string, subMateriId: string, kecualiId?: string): Promise<boolean> {
  const subMateri = await prisma.subMateri.findUnique({
    where: { id: subMateriId },
    select: { materi: { select: { subjectId: true } } },
  });
  if (!subMateri) return false;
  const kembar = await prisma.kompetensi.findFirst({
    where: {
      kode: { equals: kode.trim(), mode: "insensitive" },
      subMateri: { materi: { subjectId: subMateri.materi.subjectId } },
      ...(kecualiId ? { id: { not: kecualiId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(kembar);
}

/** Semua kompetensi milik mata pelajaran paket - kode kompetensi menjadi kunci acuan di Excel. */
export async function loadKompetensiForSubject(subjectId: string) {
  const rows = await prisma.kompetensi.findMany({
    where: { subMateri: { materi: { subjectId } } },
    orderBy: { kode: "asc" },
    select: {
      id: true,
      kode: true,
      deskripsi: true,
      levelKognitif: true,
      subMateriId: true,
      subMateri: { select: { nama: true, materi: { select: { id: true, nama: true, tingkat: true } } } },
    },
  });

  const referensi: KompetensiReferensi[] = rows.map((k) => ({
    kode: k.kode,
    deskripsi: k.deskripsi,
    levelKognitif: k.levelKognitif,
    materi: k.subMateri.materi.nama,
    subMateri: k.subMateri.nama,
    tingkat: k.subMateri.materi.tingkat,
  }));

  // Kunci pencarian huruf kecil: "mtk.bil.real.l1" dan "MTK.BIL.REAL.L1" sama.
  const byKode = new Map<string, KompetensiRef>();
  for (const k of rows) {
    byKode.set(k.kode.toLowerCase(), { id: k.id, materiId: k.subMateri.materi.id, subMateriId: k.subMateriId });
  }
  return { referensi, byKode };
}
