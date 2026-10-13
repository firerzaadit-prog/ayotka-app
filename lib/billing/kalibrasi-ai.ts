import "server-only";
import { prisma } from "@/lib/db/prisma";
import { HARI_KALIBRASI, hitungRasioKalibrasi, type KalibrasiAi } from "@/lib/billing/kalibrasi-tampilan";

/**
 * Ringkasan pemakaian token AI nyata yang dicatat tiap analisis Learning Analytics (ai_analyses.token_masuk dst.), untuk
 * dibandingkan dengan taksiran beban AI yang menentukan harga LA (lib/billing/beban-ai.ts). Tampil di Admin Pusat > Paket &
 * Rekening supaya batas "ringan/berat" bisa disetel dengan data, bukan dugaan. Tipe dan kesimpulannya: kalibrasi-tampilan.ts.
 */
const bulat = (n: number | null | undefined): number | null => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n));

/** Galat Prisma "tabel/kolom tidak ada" (P2021/P2022): migrasi pencatatan token belum diterapkan di database ini. */
export function kolomTokenBelumAda(err: unknown): boolean {
  const kode = typeof err === "object" && err !== null ? (err as { code?: unknown }).code : undefined;
  return kode === "P2021" || kode === "P2022";
}

export async function muatKalibrasiAi(sekarang: Date = new Date()): Promise<KalibrasiAi | null> {
  const sejak = new Date(sekarang.getTime() - HARI_KALIBRASI * 24 * 60 * 60 * 1000);
  try {
    const r = await prisma.aiAnalysis.aggregate({
      where: { tokenMasuk: { not: null }, taksiranTokenMasuk: { not: null }, generatedAt: { gte: sejak } },
      _count: { _all: true },
      _avg: { tokenMasuk: true, tokenKeluar: true, taksiranTokenMasuk: true },
      _sum: { tokenMasuk: true, tokenKeluar: true },
    });
    const rataMasuk = r._avg.tokenMasuk;
    const rataTaksiran = r._avg.taksiranTokenMasuk;
    return {
      hari: HARI_KALIBRASI,
      jumlah: r._count._all,
      rataTokenMasuk: bulat(rataMasuk),
      rataTokenKeluar: bulat(r._avg.tokenKeluar),
      rataTaksiran: bulat(rataTaksiran),
      rasio: hitungRasioKalibrasi(rataMasuk ?? null, rataTaksiran ?? null),
      totalTokenMasuk: r._sum.tokenMasuk ?? 0,
      totalTokenKeluar: r._sum.tokenKeluar ?? 0,
    };
  } catch (err) {
    // Migrasi belum diterapkan: ringkasan saja yang hilang, pengaturan harga tetap bisa dibuka dan disimpan.
    if (kolomTokenBelumAda(err)) return null;
    throw err;
  }
}
