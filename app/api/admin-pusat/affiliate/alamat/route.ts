import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { asalPublik } from "@/lib/utils/asal-publik";
import { alamatWebhookAffiliate } from "@/lib/billing/affiliate-auth";

const ENTITAS_BERMASALAH = ["affiliate_callback_gagal", "affiliate_callback_ganda"];

/** Data mentah panggilan (kunci -> teks) bila tercatat; catatan lama tidak punya. Nilai di luar teks dibuang. */
function dataDiterimaDariAudit(nilai: unknown): Record<string, string> | null {
  if (!nilai || typeof nilai !== "object" || Array.isArray(nilai)) return null;
  const hasil: Record<string, string> = {};
  for (const [kunci, isi] of Object.entries(nilai as Record<string, unknown>)) {
    if (typeof isi === "string") hasil[kunci] = isi;
  }
  return Object.keys(hasil).length > 0 ? hasil : null;
}

/**
 * Admin pusat: alamat lengkap (dengan rahasia) untuk diisikan ke produk di affiliate.id, plus daftar panggilan terakhir yang
 * gagal diproses atau diduga ganda (pembayaran yang mungkin perlu ditindaklanjuti manual). Rahasia tidak pernah tampil di
 * tempat lain, jadi jawaban ini tidak boleh disimpan di cache.
 */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const baris = await prisma.auditLog.findMany({
    where: { entitas: { in: ENTITAS_BERMASALAH } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, entitas: true, entitasId: true, afterJson: true, createdAt: true },
  });

  const gagal = baris.map((b) => {
    const d = (b.afterJson ?? {}) as Record<string, unknown>;
    return {
      id: b.id,
      waktu: b.createdAt.toISOString(),
      jenis: b.entitas === "affiliate_callback_ganda" ? ("ganda" as const) : ("gagal" as const),
      kode: typeof d.kode === "string" ? d.kode : null,
      pesan: typeof d.pesan === "string" ? d.pesan : null,
      email: typeof d.email === "string" ? d.email : null,
      produk: typeof d.productTitle === "string" && d.productTitle ? d.productTitle : typeof d.productId === "string" ? d.productId : null,
      nominal: typeof d.amount === "number" ? d.amount : null,
      nomorOrder: b.entitasId && b.entitasId !== "-" ? b.entitasId : null,
      dataDiterima: dataDiterimaDariAudit(d.dataDiterima),
    };
  });

  return NextResponse.json({ alamat: alamatWebhookAffiliate(asalPublik(request)), gagal }, { headers: { "Cache-Control": "no-store" } });
}
