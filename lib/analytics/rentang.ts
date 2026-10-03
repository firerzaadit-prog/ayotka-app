import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { rentangPeriode } from "@/lib/billing/periode-sekolah";
import type { RentangWaktu } from "@/lib/analytics/sekolah";

/**
 * Baca filter periode (?periodeId=...) dari URL analitik sekolah dan ubah jadi rentang waktu: dari awal periode
 * sampai akhir masa tenggangnya. Tanpa parameter = semua waktu (rentang null). Periode harus milik sekolah itu dan
 * belum dicabut - ID sembarang atau milik sekolah lain ditolak (404), format bukan UUID ditolak (400).
 */
export type HasilBacaRentang = { rentang: RentangWaktu | null } | { galat: NextResponse };

export async function bacaRentangPeriode(url: URL, schoolId: string): Promise<HasilBacaRentang> {
  const periodeId = url.searchParams.get("periodeId");
  if (!periodeId) return { rentang: null };

  if (!z.string().uuid().safeParse(periodeId).success) {
    return { galat: NextResponse.json({ error: "Periode tidak valid." }, { status: 400 }) };
  }
  const periode = await prisma.periodeLangganan.findFirst({ where: { id: periodeId, schoolId, dicabutAt: null } });
  if (!periode) {
    return { galat: NextResponse.json({ error: "Periode tidak ditemukan." }, { status: 404 }) };
  }
  return { rentang: rentangPeriode(periode) };
}
