import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { rentangPeriode } from "@/lib/billing/periode-sekolah";
import type { RentangWaktu } from "@/lib/analytics/sekolah";
import { adalahTanggalKalender, akhirHariWIB, startOfDayWIB } from "@/lib/utils/datetime";

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

/**
 * Baca filter tanggal bebas (?dari=yyyy-MM-dd&sampai=yyyy-MM-dd) untuk analitik lintas sekolah (admin pusat dan dinas
 * pendidikan), yang tidak punya satu periode langganan acuan seperti analitik sekolah. Tanggal adalah tanggal kalender
 * WIB: "dari" berarti awal hari itu dan "sampai" akhir hari itu, sehingga rentang satu hari penuh (dari = sampai)
 * mencakup seluruh hari. Salah satu boleh kosong (terbuka di satu sisi); keduanya kosong = semua waktu. Format
 * salah atau dari > sampai ditolak 400.
 */
export function bacaRentangTanggal(url: URL): HasilBacaRentang {
  const dari = url.searchParams.get("dari") || null;
  const sampai = url.searchParams.get("sampai") || null;
  if (!dari && !sampai) return { rentang: null };

  for (const [nama, nilai] of [["dari", dari], ["sampai", sampai]] as const) {
    if (nilai && !adalahTanggalKalender(nilai)) {
      return { galat: NextResponse.json({ error: `Tanggal "${nama}" tidak valid (format yyyy-MM-dd).` }, { status: 400 }) };
    }
  }
  if (dari && sampai && dari > sampai) {
    return { galat: NextResponse.json({ error: "Tanggal mulai tidak boleh setelah tanggal akhir." }, { status: 400 }) };
  }
  return { rentang: { dari: dari ? startOfDayWIB(dari) : null, sampai: sampai ? akhirHariWIB(sampai) : null } };
}
